import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service';
import { VersioningAdapter } from '../../adapters/versioning-adapter';

export function recursiveMinorBumpCommand(service?: VersioningService): Command {
  const svc = service ?? new VersioningService(new VersioningAdapter());
  return new Command('recursive-minor-bump')
    .description('Bump minor version recursively')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        await svc.recursiveMinorBump(libraries, false);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
