import { Command } from 'commander';
import { z } from 'zod';
import { VerifyAdapter, IVerifyAdapter } from '../adapters/verify-adapter';
import { adapterRegistry } from '../lib/adapter-registry';

const verifyArgsSchema = z.object({
  library: z.string(),
});

export function verifyCommand(adapter?: IVerifyAdapter): Command {
  return new Command('verify')
    .description('Generates report that verifies if an h5p library and its dependencies have been correctly computed & installed')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      const a = adapter ?? adapterRegistry.resolve<IVerifyAdapter>('verify') ?? new VerifyAdapter();
      const args = verifyArgsSchema.parse({ library });
      try {
        const result = await a.verifySetup(args.library);
        console.log(result);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
