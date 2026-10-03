import type { RepoResult } from '../../repos/process-repos.ts';
import { reportResult } from '../../repos/repo-report.ts';
import type { VersioningResult } from '../../versioning/versioning.ts';
import { ui } from '../../ui/ui.ts';

export function printVersionResults(results: RepoResult<VersioningResult>[]): void {
  for (const lib of results) {
    const msg = lib.msg;
    if (lib.skipped || ('failed' in lib && lib.failed)) {
      const detail = msg && typeof msg === 'object' ? [msg.output, msg.error].filter(Boolean).join('\n') : msg;
      reportResult({ ...lib, msg: detail });
      continue;
    }
    if (msg && typeof msg === 'object' && msg.changes) {
      ui.info(msg.version ? `${lib.name} ${msg.version}` : lib.name);
      ui.data(msg.changes.replace(/\n$/, ''));
    }
  }
}
