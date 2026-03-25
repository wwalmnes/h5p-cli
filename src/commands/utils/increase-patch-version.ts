import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service';
import { VersioningAdapter } from '../../adapters/versioning-adapter';

export function increasePatchVersionCommand(service?: VersioningService): Command {
  const svc = service ?? new VersioningService(new VersioningAdapter());
  return new Command('increase-patch-version')
    .description('Increases the patch version')
    .argument('[libraries...]', 'Library names')
    .option('-f', 'Force increase even if no new changes')
    .action(async (libraries: string[], options: { f?: boolean }) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };

      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await svc.increasePatchVersion(repos, !!options.f);
        for (const repo of results) {
          process.stdout.write(color.emphasize + repo.name + color.default);
          if ('failed' in repo && repo.failed) process.stdout.write(' ' + color.red + 'FAILED' + color.default);
          else if (repo.skipped) process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
          else process.stdout.write(' ' + color.green + 'OK' + color.default);
          if ('msg' in repo && repo.msg) process.stdout.write(' ' + repo.msg);
          process.stdout.write(lf);
        }
      } catch (error: any) {
        process.stdout.write(error.message + lf);
      }
    });
}
