import { Command } from 'commander';
import pack, { defaultPackFile } from '../../utils/commands/pack.ts';
import validate from '../../utils/commands/validate.ts';
import { ui } from '../../lib/ui.ts';

const H5P_PATTERN = /\.h5p$/;

function extractOutputFile(libraries: string[]): string | undefined {
  const index = libraries.findIndex(name => H5P_PATTERN.test(name));
  if (index === -1) return undefined;

  const file = libraries.splice(index, 1)[0];
  ui.warn(`Passing '${file}' as a positional argument is deprecated — use -o ${file} instead.`);
  return file;
}

export function packCommand(): Command {
  return new Command('pack')
    .description('Packs the given libraries')
    .argument('<libraries...>', 'Library names')
    .option('-o, --output <file>', `Output .h5p file (default: ${defaultPackFile()})`)
    .option('-r', 'Recursive packaging')
    .option('-f', 'Skip library validation')
    .action(async (libraries: string[], options: { output?: string; r?: boolean; f?: boolean }) => {
      try {
        const names = [...libraries];
        const file = options.output ?? extractOutputFile(names);

        if (!options.f) {
          const result = await validate(names);
          const notValid = result.some((item: any) => item.status !== 'ok');
          if (notValid) {
            ui.warn('validation failed; use \'-f\' to skip validation');
            process.exitCode = 1;
            return;
          }
        }

        await pack(names, { recursive: options.r, file });
      } catch (error) {
        ui.fail(error);
      }
    });
}
