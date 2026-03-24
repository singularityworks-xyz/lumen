/// <reference types="bun" />
/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

declare const Bun: typeof globalThis.Bun;

interface AppliedVersionState {
  sourceVersion: string;
  targetVersion: string;
}

interface AutobumpState {
  head: string;
  root: AppliedVersionState | null;
  triggerSignatures: Record<string, string>;
  workspaces: Record<string, AppliedVersionState>;
}

interface Workspace {
  canonicalFile: string;
  dir: string;
  managedFiles: string[];
  name: string;
}

interface RelevantEntry {
  path: string;
  signature: string;
}

interface VersionStrategy {
  normalize(content: string): string;
  readVersion(content: string): string;
  setVersion(content: string, version: string): string;
}

const EMPTY_STATE: AutobumpState = {
  head: "",
  root: null,
  triggerSignatures: {},
  workspaces: {},
};

let repoCwd = process.cwd();

const ROOT_DIR = git(["rev-parse", "--show-toplevel"]).trim();
repoCwd = ROOT_DIR;
process.chdir(ROOT_DIR);

const GIT_DIR = resolveGitDir(git(["rev-parse", "--git-dir"]).trim());
const STATE_PATH = path.join(GIT_DIR, "autobump-state.json");
const ROOT_MANAGED_FILES = ["package.json"];
const WORKSPACE_FILE_OVERRIDES: Record<string, string[]> = {
  "apps/native": [
    "package.json",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
  ],
  "apps/presence": ["package.json", "mix.exs", "config/prod.exs"],
  "apps/web": ["package.json", "src/instrumentation.ts"],
  "apps/workers": ["package.json", "src/index.ts"],
};
const CARGO_PACKAGE_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"/;
const NEWLINE_PATTERN = /\r?\n/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

if (process.argv.includes("--cleanup")) {
  if (fs.existsSync(STATE_PATH)) {
    fs.unlinkSync(STATE_PATH);
  }
  process.exit(0);
}

const workspaces = loadWorkspaces();
const workspaceByDir = new Map<string, Workspace>(
  workspaces.map((workspace) => [workspace.dir, workspace])
);
const managedWorkspaceFiles = new Set(
  workspaces.flatMap((workspace) => workspace.managedFiles)
);
const currentHead = safeGit(["rev-parse", "HEAD"])?.trim() ?? "INITIAL";

function loadWorkspaces(): Workspace[] {
  const workspaceDirs = ["apps", "packages"].flatMap((baseDir): string[] =>
    fs
      .readdirSync(path.join(ROOT_DIR, baseDir), { withFileTypes: true })
      .filter((entry: fs.Dirent) => entry.isDirectory())
      .map((entry: fs.Dirent) => path.posix.join(baseDir, entry.name))
      .filter((dir: string) =>
        fs.existsSync(path.join(ROOT_DIR, dir, "package.json"))
      )
  );

  return workspaceDirs
    .map((dir: string): Workspace => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(ROOT_DIR, dir, "package.json"), "utf8")
      ) as { name: string };
      const managedFiles = (
        WORKSPACE_FILE_OVERRIDES[dir] ?? ["package.json"]
      ).map((relativePath: string) => path.posix.join(dir, relativePath));

      return {
        canonicalFile: path.posix.join(dir, "package.json"),
        dir,
        managedFiles,
        name: packageJson.name,
      };
    })
    .sort((left, right) => left.dir.localeCompare(right.dir));
}

function collectRelevantEntries(files: string[]): RelevantEntry[] {
  const entries: RelevantEntry[] = [];

  for (const file of files) {
    if (managedWorkspaceFiles.has(file) || ROOT_MANAGED_FILES.includes(file)) {
      const normalizedStaged = readNormalizedContent(file, "staged");
      const normalizedHead = readNormalizedContent(file, "head");
      if (normalizedStaged === normalizedHead) {
        continue;
      }

      entries.push({
        path: file,
        signature: hashContent(normalizedStaged),
      });
      continue;
    }

    entries.push({
      path: file,
      signature: getGenericFileSignature(file),
    });
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function findWorkspaceDir(file: string) {
  for (const workspace of workspaces) {
    if (file === workspace.dir || file.startsWith(`${workspace.dir}/`)) {
      return workspace.dir;
    }
  }

  return null;
}

function getStagedFiles() {
  const output = git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMRD",
    "-z",
  ]);

  return output
    .split("\u0000")
    .map((file) => file.trim())
    .filter(Boolean)
    .sort();
}

function getGenericFileSignature(file: string) {
  const stagedContent = readGitFile(file, "staged");
  if (stagedContent == null) {
    return "deleted";
  }

  return hashContent(stagedContent);
}

function readNormalizedContent(file: string, source: "head" | "staged") {
  const content = readGitFile(file, source);
  if (content == null) {
    return null;
  }

  return normalizeContent(file, content);
}

function readGitFile(file: string, source: "head" | "staged") {
  try {
    if (source === "staged") {
      return git(["show", `:${file}`]);
    }

    return git(["show", `HEAD:${file}`]);
  } catch {
    return null;
  }
}

function applyVersion(workspace: Workspace, version: string) {
  for (const file of workspace.managedFiles) {
    setVersion(file, version);
  }

  stageFiles(workspace.managedFiles);
}

function restoreVersion(workspace: Workspace | undefined, version: string) {
  if (!workspace) {
    return;
  }

  for (const file of workspace.managedFiles) {
    setVersion(file, version);
  }

  stageFiles(workspace.managedFiles);
}

function restoreRootVersion(version: string) {
  setVersion(ROOT_MANAGED_FILES[0], version);
  stageFiles(ROOT_MANAGED_FILES);
}

function restoreAllAppliedVersions(currentState: AutobumpState) {
  for (const [workspaceDir, applied] of Object.entries(
    currentState.workspaces
  )) {
    restoreVersion(workspaceByDir.get(workspaceDir), applied.sourceVersion);
  }

  if (currentState.root) {
    restoreRootVersion(currentState.root.sourceVersion);
  }
}

function stageFiles(files: string[]) {
  if (files.length === 0) {
    return;
  }

  git(["add", "--", ...files]);
}

function readVersion(file: string) {
  const content = fs.readFileSync(path.join(ROOT_DIR, file), "utf8");
  return getFileStrategy(file).readVersion(content);
}

function setVersion(file: string, version: string) {
  const absolutePath = path.join(ROOT_DIR, file);
  const previous = fs.readFileSync(absolutePath, "utf8");
  const next = getFileStrategy(file).setVersion(previous, version);
  if (next !== previous) {
    fs.writeFileSync(absolutePath, next);
  }
}

function normalizeContent(file: string, content: string) {
  return getFileStrategy(file).normalize(content);
}

function getFileStrategy(file: string): VersionStrategy {
  if (file === "package.json" || file.endsWith("/package.json")) {
    return jsonVersionStrategy;
  }

  if (file === "apps/native/src-tauri/tauri.conf.json") {
    return jsonVersionStrategy;
  }

  if (file === "apps/native/src-tauri/Cargo.toml") {
    return cargoPackageVersionStrategy;
  }

  if (file === "apps/presence/mix.exs") {
    return mixVersionStrategy;
  }

  if (file === "apps/presence/config/prod.exs") {
    return prodVersionStrategy;
  }

  if (file === "apps/web/src/instrumentation.ts") {
    return webRuntimeVersionStrategy;
  }

  if (file === "apps/workers/src/index.ts") {
    return workersRuntimeVersionStrategy;
  }

  throw new Error(`Unsupported managed version file: ${file}`);
}

const jsonVersionStrategy: VersionStrategy = {
  normalize(content: string) {
    const parsed = JSON.parse(content);
    parsed.version = undefined;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  },
  readVersion(content: string) {
    const parsed = JSON.parse(content);
    if (typeof parsed.version !== "string") {
      throw new Error("Expected JSON file to contain a version string.");
    }
    return parsed.version;
  },
  setVersion(content: string, version: string) {
    const parsed = JSON.parse(content);
    parsed.version = version;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  },
};

const mixVersionStrategy = createRegexStrategy(
  /version:\s*"([^"]+)"/,
  'version: "%VERSION%"'
);

const prodVersionStrategy = createRegexStrategy(
  /version:\s*"([^"]+)"/,
  'version: "%VERSION%"'
);

const webRuntimeVersionStrategy = createRegexStrategy(
  /const WEB_VERSION = "([^"]+)";/,
  'const WEB_VERSION = "%VERSION%";'
);

const workersRuntimeVersionStrategy = createRegexStrategy(
  /const WORKERS_VERSION = "([^"]+)";/,
  'const WORKERS_VERSION = "%VERSION%";'
);

const cargoPackageVersionStrategy: VersionStrategy = {
  normalize(content: string) {
    return replaceCargoPackageVersion(content, "__VERSION__");
  },
  readVersion(content: string) {
    const version = readCargoPackageVersion(content);
    if (!version) {
      throw new Error("Expected Cargo.toml to contain a package version.");
    }
    return version;
  },
  setVersion(content: string, version: string) {
    return replaceCargoPackageVersion(content, version);
  },
};

function createRegexStrategy(
  pattern: RegExp,
  replacementTemplate: string
): VersionStrategy {
  return {
    normalize(content) {
      if (!pattern.test(content)) {
        return content;
      }

      return replaceWithPattern(
        content,
        pattern,
        replacementTemplate,
        "__VERSION__"
      );
    },
    readVersion(content) {
      const match = content.match(pattern);
      if (!match) {
        throw new Error(`Unable to find version pattern ${pattern}`);
      }
      return match[1];
    },
    setVersion(content, version) {
      return replaceWithPattern(content, pattern, replacementTemplate, version);
    },
  };
}

function replaceWithPattern(
  content: string,
  pattern: RegExp,
  replacementTemplate: string,
  version: string
) {
  if (!pattern.test(content)) {
    throw new Error(`Unable to update version using pattern ${pattern}`);
  }

  return content.replace(
    pattern,
    replacementTemplate.replace("%VERSION%", version)
  );
}

function readCargoPackageVersion(content: string) {
  let inPackageSection = false;

  for (const line of content.split(NEWLINE_PATTERN)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inPackageSection = trimmed === "[package]";
      continue;
    }

    if (!inPackageSection) {
      continue;
    }

    const match = line.match(CARGO_PACKAGE_VERSION_PATTERN);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function replaceCargoPackageVersion(content: string, version: string) {
  const lines = content.split(NEWLINE_PATTERN);
  let inPackageSection = false;
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inPackageSection = trimmed === "[package]";
      continue;
    }

    if (!inPackageSection || replaced) {
      continue;
    }

    if (CARGO_PACKAGE_VERSION_PATTERN.test(lines[index])) {
      lines[index] = `version = "${version}"`;
      replaced = true;
    }
  }

  if (!replaced) {
    throw new Error("Unable to update Cargo package version.");
  }

  return `${lines.join("\n")}\n`;
}

function incrementVersion(version: string) {
  const match = version.match(VERSION_PATTERN);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const [, major, minor, patch] = match;
  let nextMajor = Number(major);
  let nextMinor = Number(minor);
  let nextPatch = Number(patch) + 1;

  if (nextPatch >= 10) {
    nextPatch = 0;
    nextMinor += 1;
  }

  if (nextMinor >= 10) {
    nextMinor = 0;
    nextMajor += 1;
  }

  return `${nextMajor}.${nextMinor}.${nextPatch}`;
}

function hasOverlap(
  previousSignatures: Record<string, string>,
  entries: RelevantEntry[]
) {
  return entries.some(
    (entry) => previousSignatures[entry.path] === entry.signature
  );
}

function loadState(): AutobumpState | null {
  if (!fs.existsSync(STATE_PATH)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as AutobumpState;
}

function writeState(nextState: AutobumpState) {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`);
}

function clearState() {
  if (fs.existsSync(STATE_PATH)) {
    fs.unlinkSync(STATE_PATH);
  }
}

function hashContent(content: string | null) {
  return new Bun.CryptoHasher("sha256")
    .update(content ?? "deleted")
    .digest("hex");
}

function git(args: string[]) {
  const decoder = new TextDecoder();
  const result = Bun.spawnSync({
    cmd: ["git", ...args],
    cwd: repoCwd,
    stderr: "pipe",
    stdout: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(
      decoder.decode(result.stderr).trim() ||
        `git ${args.join(" ")} exited with code ${result.exitCode}`
    );
  }

  return decoder.decode(result.stdout);
}

function safeGit(args: string[]) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function resolveGitDir(gitDir: string) {
  return path.isAbsolute(gitDir) ? gitDir : path.join(ROOT_DIR, gitDir);
}

function main() {
  let state = loadState();
  if (state && state.head !== currentHead) {
    state = null;
  }

  const stagedFiles = getStagedFiles();
  const relevantEntries = collectRelevantEntries(stagedFiles);
  const desiredWorkspaceDirs = new Set<string>(
    relevantEntries
      .map((entry) => findWorkspaceDir(entry.path))
      .filter((dir): dir is string => dir !== null)
  );
  const shouldBumpRoot = relevantEntries.length > 0;

  if (
    state &&
    relevantEntries.length > 0 &&
    !hasOverlap(state.triggerSignatures, relevantEntries)
  ) {
    restoreAllAppliedVersions(state);
    state = null;
  }

  if (!state) {
    state = structuredClone(EMPTY_STATE);
    state.head = currentHead;
  }

  if (relevantEntries.length === 0) {
    restoreAllAppliedVersions(state);
    clearState();
    return;
  }

  for (const [workspaceDir, applied] of Object.entries(state.workspaces)) {
    if (!desiredWorkspaceDirs.has(workspaceDir)) {
      restoreVersion(workspaceByDir.get(workspaceDir), applied.sourceVersion);
    }
  }
  state.workspaces = Object.fromEntries(
    Object.entries(state.workspaces).filter(([workspaceDir]) =>
      desiredWorkspaceDirs.has(workspaceDir)
    )
  );

  for (const workspaceDir of desiredWorkspaceDirs) {
    const workspace = workspaceByDir.get(workspaceDir);
    if (!workspace) {
      continue;
    }

    const applied = state.workspaces[workspaceDir];
    if (!applied) {
      const sourceVersion = readVersion(workspace.canonicalFile);
      const targetVersion = incrementVersion(sourceVersion);
      applyVersion(workspace, targetVersion);
      state.workspaces[workspaceDir] = { sourceVersion, targetVersion };
      continue;
    }

    applyVersion(workspace, applied.targetVersion);
  }

  if (shouldBumpRoot) {
    if (state.root) {
      setVersion(ROOT_MANAGED_FILES[0], state.root.targetVersion);
      stageFiles(ROOT_MANAGED_FILES);
    } else {
      const sourceVersion = readVersion(ROOT_MANAGED_FILES[0]);
      const targetVersion = incrementVersion(sourceVersion);
      setVersion(ROOT_MANAGED_FILES[0], targetVersion);
      stageFiles(ROOT_MANAGED_FILES);
      state.root = { sourceVersion, targetVersion };
    }
  }

  state.triggerSignatures = Object.fromEntries(
    relevantEntries.map((entry) => [entry.path, entry.signature])
  );

  if (!state.root && Object.keys(state.workspaces).length === 0) {
    clearState();
    return;
  }

  writeState(state);
}

main();
