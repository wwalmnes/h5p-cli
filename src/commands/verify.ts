import { Command } from 'commander';
import { z } from 'zod';
import { verifySetup } from '../install/install.ts';
import { ui } from '../ui/ui.ts';

const verifyArgsSchema = z.object({
  library: z.string(),
});

export function verifyCommand(): Command {
  return new Command('verify')
    .description('Generates report that verifies if an h5p library and its dependencies have been correctly computed & installed')
    .argument('<library>', 'Library name')
    .action(async (library: string) => {
      try {
        const args = verifyArgsSchema.parse({ library });
        const result = await verifySetup(args.library);
        ui.data(JSON.stringify(result, null, 2));
      } catch (error) {
        ui.fail(error);
      }
    });
}
