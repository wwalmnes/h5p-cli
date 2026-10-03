import { Command } from 'commander';
import { z } from 'zod';
import { register } from '../install/register.ts';
import { ui } from '../ui/ui.ts';

const registerArgsSchema = z.object({
  input: z.string(),
});

export function registerCommand(): Command {
  return new Command('register')
    .description('Updates local library registry entry')
    .argument('<input>', 'URL or path to registry file')
    .action(async (input: string) => {
      try {
        const args = registerArgsSchema.parse({ input });
        await register(args.input);
      } catch (error) {
        ui.fail(error);
      }
    });
}
