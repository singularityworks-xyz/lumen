import { spawnSync } from "node:child_process";

type GitState = "missing" | "unavailable" | "worktree";

interface CommandOptions {
  stdio: "ignore" | "inherit";
}

interface CommandResult {
  error?: Error;
  status: number | null;
}

type CommandRunner = (
  command: string,
  args: string[],
  options: CommandOptions
) => CommandResult;

interface PrepareDependencies {
  detectGitState: () => GitState;
  installHooks: () => number;
  log: (message: string) => void;
}

export const spawnCommand: CommandRunner = (command, args, options) => {
  const result = spawnSync(command, args, options);

  return {
    error: result.error,
    status: result.status,
  };
};

export function detectGitState(
  commandRunner: CommandRunner = spawnCommand
): GitState {
  const result = commandRunner("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  });

  if (result.error) {
    return "unavailable";
  }

  return result.status === 0 ? "worktree" : "missing";
}

export function installHooks(
  commandRunner: CommandRunner = spawnCommand
): number {
  const result = commandRunner("lefthook", ["install"], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

export function runPrepare({
  detectGitState: getGitState = detectGitState,
  installHooks: runInstallHooks = installHooks,
  log = console.log,
}: Partial<PrepareDependencies> = {}): number {
  const gitState = getGitState();

  if (gitState === "missing") {
    log("Skipping lefthook install: no git worktree detected.");
    return 0;
  }

  if (gitState === "unavailable") {
    log("Skipping lefthook install: git is unavailable in this environment.");
    return 0;
  }

  return runInstallHooks();
}

if (import.meta.main) {
  process.exit(runPrepare());
}
