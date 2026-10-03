import { Command } from 'commander';
import { fetchRegistry } from '../../h5p/h5p-org-registry.ts';

const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  red: '\x1B[31m',
};
const lf = '\u000A';

export function utilsListCommand(): Command {
  return new Command('list')
    .description('List all H5P libraries')
    .action(async () => {
      try {
        const libraries = await fetchRegistry();
        for (const name in libraries) {
          process.stdout.write('  ' + color.emphasize + name + color.default + lf);
        }
      } catch (error: any) {
        process.stdout.write(color.red + 'ERROR: ' + color.default + error.message + lf);
      }
    });
}
