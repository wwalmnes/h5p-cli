import { Command } from 'commander';

export function commitsSinceCommand(): Command {
  return new Command('commits-since')
    .description('Show commits since last version')
    .argument('[numVersions]', 'Number of versions (default 1)')
    .argument('[libraries...]', 'Library names')
    .action((numVersions: string | undefined, libraries: string[]) => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };

      let versions = 1;
      if (numVersions && numVersions.match(/^-?\d+$/i)) {
        versions = Math.abs(parseInt(numVersions));
      } else if (numVersions) {
        libraries = [numVersions, ...libraries];
      }

      function handleChanges(error: any, changes: any[]) {
        if (error) return process.stdout.write(error + lf);
        for (let i = 0; i < changes.length; i++) {
          const lib = changes[i];
          if (lib.skipped) {
            process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.yellow + lib.msg + color.default + lf);
          } else if (lib.failed && lib.msg && lib.msg.error) {
            process.stdout.write(color.emphasize + lib.name + color.default + lf);
            if (lib.msg.output) process.stdout.write(lib.msg.output + lf);
            process.stdout.write(color.red + lib.msg.error + color.default + lf);
          } else if (lib.failed) {
            process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.red + lib.msg + color.default + lf);
          } else if (lib.msg && lib.msg.version && lib.msg.changes) {
            process.stdout.write(color.emphasize + lib.name + color.default + ' ' + color.green + lib.msg.version + color.default + lf);
            process.stdout.write(lib.msg.changes + lf);
          } else if (lib.msg && lib.msg.changes) {
            process.stdout.write(color.emphasize + lib.name + color.default + lf);
            process.stdout.write(lib.msg.changes + lf);
          }
        }
      }

      h5p.commitsSinceAll(versions, libraries, handleChanges);
    });
}
