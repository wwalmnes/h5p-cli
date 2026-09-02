/**
 * Renders the outcome of a per-repository operation.
 *
 * Every multi-repo command used to carry its own copy of this block, complete
 * with hand-rolled ANSI literals written straight to stdout. It lives in lib/
 * rather than beside the git commands because what it renders is a
 * `RepoOpResult` — not anything git-specific.
 *
 * These lines are chrome, not data: they go to stderr and are dropped by
 * `--quiet`. Only output a script would consume belongs on stdout.
 */

import { ui } from './ui.ts';
import type { RepoOpResult } from './repo-types.ts';

/** Widest shape a result can arrive in: `name` optional, `msg` unstructured. */
export type ReportableRepo = Partial<RepoOpResult<any>> & { msg?: any };

function label(repo: ReportableRepo): string {
  return repo.name ?? '';
}

/** `msg` is only a string in practice here; anything else is left to String(). */
function suffix(msg: unknown): string {
  return msg === undefined || msg === '' ? '' : ` ${msg}`;
}

/**
 * One line per repo: green OK, yellow SKIPPED, red FAILED. A failure's detail
 * follows on its own line rather than being crammed into the error itself.
 */
export function reportResult(repo: ReportableRepo | undefined): void {
  if (!repo) return;

  if (repo.failed || repo.error) {
    ui.error(`${label(repo)} FAILED`);
    const detail = repo.error ?? repo.msg;
    if (detail) ui.info(String(detail));
    return;
  }

  if (repo.skipped) {
    ui.warn(`${label(repo)} SKIPPED${suffix(repo.msg)}`);
    return;
  }

  ui.success(`${label(repo)} OK${suffix(repo.msg)}`);
}

export function reportResults(repos: ReportableRepo[] | undefined): void {
  if (!repos) return;
  for (const repo of repos) reportResult(repo);
}

/**
 * A repo's changed files, titled with its name and branch. `ui.list` boxes this
 * on a terminal and falls back to bare `- item` lines when piped.
 */
export function reportChanges(repo: ReportableRepo): void {
  const title = `${label(repo)}${repo.branch ? ` (${repo.branch})` : ''}${
    repo.commit ? ` ${repo.commit}` : ''
  }`;

  if (repo.error) {
    ui.error(`${title}: ${repo.error}`);
    return;
  }

  ui.list(repo.changes ?? [], { title, empty: title });
}

type PullSummary = {
  total: number;
  upToDate: number;
  updated: number;
  failed: number;
};

function plural(count: number): string {
  return count === 1 ? 'repository' : 'repositories';
}

export function summarize(repos: ReportableRepo[]): PullSummary {
  const summary: PullSummary = { total: repos.length, upToDate: 0, updated: 0, failed: 0 };

  for (const repo of repos) {
    if (repo.error || repo.failed) summary.failed += 1;
    // git says "Already up to date." — older versions hyphenated it.
    else if (typeof repo.msg === 'string' && /Already up[- ]to[- ]date/i.test(repo.msg)) {
      summary.upToDate += 1;
    }
    else summary.updated += 1;
  }

  return summary;
}

/** Descending by name, matching the order the old output helper produced. */
export function sortByNameDescending(repos: ReportableRepo[]): ReportableRepo[] {
  return [...repos].sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
}

export function reportSummary(repos: ReportableRepo[]): void {
  const summary = summarize(repos);

  ui.info(`Finished processing ${summary.total} ${plural(summary.total)}`);
  if (summary.upToDate) ui.info(`${summary.upToDate} ${plural(summary.upToDate)} already up to date.`);
  if (summary.updated) ui.info(`${summary.updated} ${plural(summary.updated)} updated.`);
  if (summary.failed) ui.warn(`${summary.failed} ${plural(summary.failed)} failed.`);
}
