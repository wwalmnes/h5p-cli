import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service.ts';
import { VersioningAdapter } from '../../adapters/versioning-adapter.ts';

export function listDepsCommand(service?: VersioningService): Command {
  const svc = service ?? new VersioningService(new VersioningAdapter());
  return new Command('list-deps')
    .description('List all libraries that have a dependency to the given library')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        await svc.recursiveMinorBump(libraries, true);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
