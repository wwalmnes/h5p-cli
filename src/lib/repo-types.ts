/**
 * Shapes shared by everything that operates on a set of repositories.
 *
 * These live here rather than in process-repos.ts so that adapters, services and
 * the output helpers can all agree on one result shape without importing the
 * repo-walking machinery.
 */

/**
 * Outcome of an operation performed on a single repository.
 *
 * `TMsg` is the payload of `msg`; most callers report a plain string, but
 * versioning reports a structured summary.
 */
export type RepoOpResult<TMsg = string> = {
  name: string;
  skipped?: boolean;
  failed?: boolean;
  msg?: TMsg;
  branch?: string;
  commit?: string;
  changes?: string[];
  error?: string;
};

/** Captured output of a subprocess. */
export type ExecResult = {
  stdout: string;
  stderr: string;
};

/** Output sink injected into services, so tests can capture what was printed. */
export type Logger = {
  log: (...args: any[]) => void;
};
