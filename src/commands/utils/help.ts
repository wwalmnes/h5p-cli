import { Command } from 'commander';
import { z } from 'zod';
import { ui } from '../../lib/ui.ts';

const helpArgsSchema = z.object({
  command: z.string().optional(),
});

export function utilsHelpCommand(): Command {
  return new Command('help')
    .description('Displays help for utils commands')
    .argument('[command]', 'Command name')
    .action((command: string | undefined) => {
      const args = helpArgsSchema.parse({ command });
      if (args.command) {
        ui.info(`No help available for "${args.command}".`);
      } else {
        ui.info('Run `h5p utils --help` to see all available utils commands.');
      }
    });
}
