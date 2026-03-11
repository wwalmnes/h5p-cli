import { Command } from 'commander';
import { z } from 'zod';
import { InstallAdapter } from '../adapters/install-adapter';
import { InstallService } from '../services/install-service';
import config from '../../configLoader';

const installArgsSchema = z.object({
  library: z.string(),
  mode: z.string().optional(),
});

export function installCommand(service?: InstallService): Command {
  const svc = service ?? new InstallService(new InstallAdapter(), config.folders.libraries);
  return new Command('install')
    .description('Installs dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .action(async (library: string, mode: string | undefined) => {
      const args = installArgsSchema.parse({ library, mode });
      try {
        await svc.install(args.library, args.mode);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
