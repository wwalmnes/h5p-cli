import { Command } from 'commander';
import { fetchRegistry } from '../../h5p/h5p-org-registry.ts';
import { ui } from '../../ui/ui.ts';

export function utilsListCommand(): Command {
  return new Command('list')
    .description('List all H5P libraries')
    .action(async () => {
      try {
        const libraries = await fetchRegistry();
        for (const name in libraries) {
          ui.data(name);
        }
      } catch (error) {
        ui.fail(error);
      }
    });
}
