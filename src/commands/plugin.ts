import { Command } from 'commander';
import path from 'path';
import { PluginAdapter } from '../adapters/plugin-adapter';
import { PluginService } from '../services/plugin-service';

const H5P_CLI_ROOT = path.resolve(__dirname, '..');

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
        console.log('> error');
        console.log(error);
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
      if (plugins.length === 0) {
        console.log('> no plugins installed');
      } else {
        console.log('> installed plugins:');
        for (const p of plugins) console.log(`  - ${p.name} (${p.path})`);
      }
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
        console.log('> error');
        console.log(error);
      }
    });

  return plugin;
}
