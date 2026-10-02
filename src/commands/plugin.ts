import { Command } from 'commander';
import { installPlugin, listPlugins, uninstallPlugin } from '../lib/plugins.ts';
import { ui } from '../lib/ui.ts';

export function pluginCommand(): Command {
  const plugin = new Command('plugin').description('Manage h5p-cli plugins');

  plugin
    .command('install <source>')
    .description('Install a plugin from a GitHub URL (https or ssh) or a local path')
    .action(async (source: string) => {
      try {
        await installPlugin(source);
      } catch (error) {
        ui.fail(error);
      }
    });

  plugin
    .command('list')
    .description('List installed plugins')
    .action(() => {
      ui.table(listPlugins().map(p => [p.name, p.path]), { head: ['Name', 'Path'] });
    });

  plugin
    .command('uninstall <name>')
    .description('Uninstall a plugin by name')
    .action((name: string) => {
      try {
        uninstallPlugin(name);
      } catch (error) {
        ui.fail(error);
      }
    });

  return plugin;
}
