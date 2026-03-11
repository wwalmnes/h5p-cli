import { Command } from 'commander';
import { z } from 'zod';
import { MissingAdapter } from '../adapters/missing-adapter';
import { MissingService } from '../services/missing-service';

const missingArgsSchema = z.object({
  library: z.string(),
});

export function missingCommand(service?: MissingService): Command {
  const svc = service ?? new MissingService(new MissingAdapter());
  return new Command('missing')
    .description('Computes missing dependencies for h5p library')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const args = missingArgsSchema.parse({ library });
      try {
        await svc.missing(args.library);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
