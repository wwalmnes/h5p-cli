import { Command } from 'commander';
import { z } from 'zod';

const helpArgsSchema = z.object({
  command: z.string().optional(),
});

export function utilsHelpCommand(): Command {
  return new Command('help')
    .description('Displays help for utils commands')
    .argument('[command]', 'Command name')
    .action((command: string | undefined) => {
      const args = helpArgsSchema.parse({ command });
      const lf = '\u000A';
      if (args.command) {
        console.log(`No help available for "${args.command}".`);
      } else {
        console.log('Run `h5p utils --help` to see all available utils commands.');
      }
    });
}
