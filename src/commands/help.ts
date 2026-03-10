import { Command } from 'commander';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

const helpArgsSchema = z.object({
  command: z.string().optional(),
});

export function helpCommand(): Command {
  return new Command('help')
    .description('Show help documentation')
    .argument('[command]', 'Command to get help for')
    .action((command: string | undefined) => {
      const args = helpArgsSchema.parse({ command });
      let marked = require('marked');
      const markedTerminal = require('marked-terminal');
      marked.setOptions({ mangle: false, headerIds: false, renderer: new markedTerminal() });
      marked = marked.marked;
      try {
        const docsPath = path.join(path.dirname(require.resolve('../../h5p.js')), 'assets/docs/commands.md');
        const help = fs.readFileSync(docsPath, 'utf-8');
        if (args.command) {
          const regexp = ` \`h5p ${args.command}(.*?)(\\n\\n|\\Z)`;
          const data = help.match(new RegExp(regexp, 's'))?.[0];
          if (!data) {
            console.log(`> "${args.command}" is not a valid command`);
            return;
          }
          console.log(marked(data));
          return;
        }
        console.log(marked(help));
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
