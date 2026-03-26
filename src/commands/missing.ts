import { Command } from 'commander';
import { z } from 'zod';
import { MissingAdapter, IMissingAdapter } from '../adapters/missing-adapter';
import { MissingService } from '../services/missing-service';
import { adapterRegistry } from '../lib/adapter-registry';

const missingArgsSchema = z.object({
  library: z.string(),
});

export function missingCommand(service?: MissingService): Command {
  return new Command('missing')
    .description('Computes missing dependencies for h5p library')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const svc = service ?? new MissingService(adapterRegistry.resolve<IMissingAdapter>('missing') ?? new MissingAdapter());
      const args = missingArgsSchema.parse({ library });
      try {
        await svc.missing(args.library);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
