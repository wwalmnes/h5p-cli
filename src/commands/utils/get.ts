import { Command } from 'commander';
import { cloneLibrary, resolveCollection, type RegistryLibrary } from '../../h5p/h5p-org-registry.ts';
import { reportResult } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function getCommand(): Command {
  return new Command('get')
    .description('Clone library and all dependencies')
    .argument('[libraries...]', 'Repo names, e.g. h5p-accordion')
    .option('--https', 'Use https:// urls for git repos instead of ssh urls')
    .addHelpText('after', `
Examples:
  $ h5p utils get h5p-accordion
  $ h5p utils get --https h5p-accordion h5p-blanks`)
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
