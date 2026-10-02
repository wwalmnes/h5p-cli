import { Command } from 'commander';
import { cloneLibrary, resolveCollection, type RegistryLibrary } from '../../logic/h5p-org-registry.ts';
import { reportResult } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function getCommand(): Command {
  return new Command('get')
    .description('Clone library and all dependencies')
    .argument('[libraries...]', 'Library names')
    .option('--https', 'Use https:// urls for git repos instead of ssh urls')
    .action(async (libraries: string[], options: { https?: boolean }) => {
      const fetchWithHttps = options.https ?? false;

      if (!libraries.length) {
        ui.warn('No library specified.');
        return;
      }

      let collection: Map<string, RegistryLibrary>;
      try {
        ui.status('lookup', 'Looking up dependencies...');
        collection = await resolveCollection(libraries);
        ui.statusDone('lookup');
      } catch (error) {
        ui.statusDone('lookup');
        ui.fail(error);
        return;
      }

      for (const [name, entry] of collection) {
        ui.status('clone', `Cloning into '${name}'...`);
        const { status, error } = await cloneLibrary(name, entry.repository, fetchWithHttps);
        ui.statusDone('clone');

        reportResult({
          name,
          skipped: status === 'skipped',
          failed: status === 'failed',
          error: status === 'failed' ? (error ?? undefined) : undefined,
        });
      }
    });
}
