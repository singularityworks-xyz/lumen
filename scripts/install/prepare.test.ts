import { describe, expect, mock, test } from "bun:test";

import { detectGitState, installHooks, runPrepare } from "./prepare";

describe("detectGitState", () => {
  test("returns worktree when git rev-parse succeeds", () => {
    expect(
      detectGitState(() => ({
        status: 0,
      }))
    ).toBe("worktree");
  });

  test("returns missing when git rev-parse fails", () => {
    expect(
      detectGitState(() => ({
        status: 128,
      }))
    ).toBe("missing");
  });

  test("returns unavailable when git cannot be executed", () => {
    expect(
      detectGitState(() => ({
        error: new Error("spawn git ENOENT"),
        status: null,
      }))
    ).toBe("unavailable");
  });
});

describe("installHooks", () => {
  test("returns the lefthook exit code", () => {
    expect(
      installHooks((command, args, options) => {
        expect(command).toBe("lefthook");
        expect(args).toEqual(["install"]);
        expect(options).toEqual({ stdio: "inherit" });

        return {
          status: 0,
        };
      })
    ).toBe(0);
  });

  test("throws when lefthook cannot be executed", () => {
    expect(() =>
      installHooks(() => ({
        error: new Error("spawn lefthook ENOENT"),
        status: null,
      }))
    ).toThrow("spawn lefthook ENOENT");
  });
});

describe("runPrepare", () => {
  test("skips hook installation outside a git worktree", () => {
    const log = mock(() => undefined);
    const runInstallHooks = mock(() => 1);

    expect(
      runPrepare({
        detectGitState: () => "missing",
        installHooks: runInstallHooks,
        log,
      })
    ).toBe(0);

    expect(runInstallHooks).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Skipping lefthook install: no git worktree detected."
    );
  });

  test("skips hook installation when git is unavailable", () => {
    const log = mock(() => undefined);
    const runInstallHooks = mock(() => 1);

    expect(
      runPrepare({
        detectGitState: () => "unavailable",
        installHooks: runInstallHooks,
        log,
      })
    ).toBe(0);

    expect(runInstallHooks).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Skipping lefthook install: git is unavailable in this environment."
    );
  });

  test("installs hooks inside a git worktree", () => {
    const log = mock(() => undefined);
    const runInstallHooks = mock(() => 7);

    expect(
      runPrepare({
        detectGitState: () => "worktree",
        installHooks: runInstallHooks,
        log,
      })
    ).toBe(7);

    expect(runInstallHooks).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});
