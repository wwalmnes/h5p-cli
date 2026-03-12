import { Command } from 'commander';
import { z } from 'zod';
import { InstallAdapter } from '../adapters/install-adapter';
import { InstallService } from '../services/install-service';
import config from '../../configLoader';

const installArgsSchema = z.object({
  library: z.string(),
  mode: z.union([z.literal('view'), z.literal('edit')], {
    errorMap: () => ({ message: 'Mode must be "view" or "edit"' }),
  }).optional(),
});

export function installCommand(service?: InstallService): Command {
  const svc = service ?? new InstallService(new InstallAdapter(), config.folders.libraries);
  return new Command('install')
    .description('Installs dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .action(async (library: string, mode: 'view' | 'edit' | undefined) => {
      const result = installArgsSchema.safeParse({ library, mode });
      if (!result.success) {
        for (const issue of result.error.issues) {
          console.error(issue.message);
        }
        return;
      }

      const args = result.data;

      try {
        await svc.install(args.library, args.mode);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
