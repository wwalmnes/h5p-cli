import type { RepoResult } from '../../lib/process-repos.ts';
import type { VersioningResult } from '../../services/versioning-service.ts';

const lf = '\u000A';
const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m',
};

export function printVersionResults(results: RepoResult<VersioningResult>[]): void {
  for (const lib of results) {
    if (lib.skipped) {
      process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.yellow + lib.msg + color.default + lf);
    } else if ('failed' in lib && lib.failed) {
      const msg = lib.msg;
      if (msg && typeof msg === 'object' && msg.error) {
        process.stdout.write(color.emphasize + lib.name + color.default + lf);
        if (msg.output) process.stdout.write(msg.output + lf);
        process.stdout.write(color.red + msg.error + color.default + lf);
      } else {
        process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.red + String(lib.msg ?? '') + color.default + lf);
      }
    } else {
      const msg = lib.msg;
      if (msg && typeof msg === 'object' && msg.version && msg.changes) {
        process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.green + msg.version + color.default + lf);
        process.stdout.write(msg.changes + lf);
      } else if (msg && typeof msg === 'object' && msg.changes) {
        process.stdout.write(color.emphasize + lib.name + color.default + lf);
        process.stdout.write(msg.changes + lf);
      }
    }
  }
}
