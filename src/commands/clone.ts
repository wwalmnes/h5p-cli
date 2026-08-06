import { Command } from 'commander';
import { z } from 'zod';
import { InstallAdapter, type IInstallAdapter } from '../adapters/install-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const cloneArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
});

export function cloneCommand(adapter?: IInstallAdapter): Command {
  return new Command('clone')
    .description('Clones dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (library: string, mode: 'view' | 'edit' | undefined, options) => {
      const a = adapter ?? adapterRegistry.resolve<IInstallAdapter>(options.adapter ?? 'install') ?? new InstallAdapter();
      const result = cloneArgsSchema.safeParse({ library, mode });

      if (!result.success) {
        for (const issue of result.error.issues) {
          ui.error(issue.message);
        }
        return;
      }

      const args = result.data;

      try {
        ui.info(`cloning ${args.library} library and dependencies into "${config.folders.libraries}" folder`);
        await a.getWithDependencies('clone', args.library, args.mode);
        ui.success(`done installing ${args.library}`);
      } catch (error) {
        ui.error(error);
      }
    });
}
