import { Command } from 'commander';
import { z } from 'zod';
import { VerifyAdapter, type IVerifyAdapter } from '../adapters/verify-adapter.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import { ui } from '../lib/ui.ts';

const verifyArgsSchema = z.object({
  library: z.string(),
});

export function verifyCommand(adapter?: IVerifyAdapter): Command {
  return new Command('verify')
    .description('Generates report that verifies if an h5p library and its dependencies have been correctly computed & installed')
    .argument('<library>', 'Library name')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (library: string, options) => {
      const a = adapter ?? adapterRegistry.resolve<IVerifyAdapter>(options.adapter ?? 'verify') ?? new VerifyAdapter();
      const args = verifyArgsSchema.parse({ library });
      try {
        const result = await a.verifySetup(args.library);
        console.log(result);
      } catch (error) {
        ui.error(error);
      }
    });
}
