import { Command } from 'commander';
import { z } from 'zod';
import { MissingAdapter, type IMissingAdapter } from '../adapters/missing-adapter.ts';
import { MissingService } from '../services/missing-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const missingArgsSchema = z.object({
  library: z.string(),
});

export function missingCommand(service?: MissingService): Command {
  return new Command('missing')
    .description('Computes missing dependencies for h5p library')
    .argument('<library>', 'Library name')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (library: string, options) => {
      const svc = service ?? new MissingService(adapterRegistry.resolve<IMissingAdapter>(options.adapter ?? 'missing') ?? new MissingAdapter());
      try {
        const args = missingArgsSchema.parse({ library });
        await svc.missing(args.library);
      } catch (error) {
        ui.fail(error);
      }
    });
}
