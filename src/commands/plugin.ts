import { Command } from 'commander';
import path from 'path';
import { PluginAdapter } from '../adapters/plugin-adapter.ts';
import { PluginService } from '../services/plugin-service.ts';
import { ui } from '../lib/ui.ts';

const H5P_CLI_ROOT = path.resolve(import.meta.dirname, '..', '..');

export function pluginCommand(service?: PluginService): Command {
  const plugin = new Command('plugin').description('Manage h5p-cli plugins');

  plugin
    .command('install <source>')
    .description('Install a plugin from a GitHub URL (https or ssh) or a local path')
    .action(async (source: string) => {
      const svc = service ?? new PluginService(
        new PluginAdapter(H5P_CLI_ROOT),
        path.join(H5P_CLI_ROOT, 'plugins')
      );
      try {
        await svc.install(source);
      } catch (error) {
        ui.fail(error);
      }
    });

  plugin
    .command('list')
    .description('List installed plugins')
    .action(() => {
      const svc = service ?? new PluginService(
        new PluginAdapter(H5P_CLI_ROOT),
        path.join(H5P_CLI_ROOT, 'plugins')
      );
      const plugins = svc.list();

      ui.table(plugins.reduce<string[][]>((acc, p) => {
        acc.push([p.name, p.path]);
        return acc;
      }, []), {
        head: ['Name', 'Path']
      });
    });

  plugin
    .command('uninstall <name>')
    .description('Uninstall a plugin by name')
    .action((name: string) => {
      const svc = service ?? new PluginService(
        new PluginAdapter(H5P_CLI_ROOT),
        path.join(H5P_CLI_ROOT, 'plugins')
      );
      try {
        svc.uninstall(name);
      } catch (error) {
        ui.fail(error);
      }
    });

  return plugin;
}
