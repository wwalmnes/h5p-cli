import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service.ts';
import { VersioningAdapter } from '../../adapters/versioning-adapter.ts';

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
