import { Command } from 'commander';
import { z } from 'zod';
import { InstallAdapter, IInstallAdapter } from '../adapters/install-adapter';
import { adapterRegistry } from '../lib/adapter-registry';
import config from '../../configLoader';

const installArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
});

export function installCommand(adapter?: IInstallAdapter): Command {
  return new Command('install')
    .description('Installs dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .action(async (library: string, mode: 'view' | 'edit' | undefined) => {
      const a = adapter ?? adapterRegistry.resolve<IInstallAdapter>('install') ?? new InstallAdapter();
      const result = installArgsSchema.safeParse({ library, mode });
      if (!result.success) {
        for (const issue of result.error.issues) {
          console.error(issue.message);
        }
        return;
      }

      const args = result.data;

      try {
        console.log(`> downloading ${args.library} library and dependencies into "${config.folders.libraries}" folder`);
        await a.getWithDependencies('download', args.library, args.mode);
        console.log(`> done installing ${args.library}`);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
