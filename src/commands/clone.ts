import { Command } from 'commander';
import { z } from 'zod';
import { InstallAdapter } from '../adapters/install-adapter';
import { CloneService } from '../services/clone-service';
import config from '../../configLoader';

const cloneArgsSchema = z.object({
  library: z.string(),
  mode: z.string().optional(),
});

export function cloneCommand(service?: CloneService): Command {
  const svc = service ?? new CloneService(new InstallAdapter(), config.folders.libraries);
  return new Command('clone')
    .description('Clones dependencies for h5p library')
    .argument('<library>', 'Library name')
    .argument('[mode]', 'Mode (view or edit)')
    .action(async (library: string, mode: string | undefined) => {
      const args = cloneArgsSchema.parse({ library, mode });
      try {
        await svc.clone(args.library, args.mode);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
