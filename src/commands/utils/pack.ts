import { Command } from 'commander';
import pack from '../../utils/commands/pack.ts';
import validate from '../../utils/commands/validate.ts';
import Input from '../../utils/utility/input.ts';

export function packCommand(): Command {
  return new Command('pack')
    .description('Packs the given libraries')
    .argument('<libraries...>', 'Library names (last arg can be output .h5p file)')
    .option('-r', 'Recursive packaging')
    .option('-f', 'Skip library validation')
    .action(async (libraries: string[], options: { r?: boolean; f?: boolean }) => {
      const inputList: string[] = [];
      if (options.r) inputList.push('-r');
      if (options.f) inputList.push('-f');
      inputList.push(...libraries);

      try {
        const input = new Input(inputList);
        if (!input.hasFlag('-f')) {
          const result = await validate(...inputList);
          const notValid = result.some((item: any) => item.status !== 'ok');
          if (notValid) {
            console.log('validation failed; use \'-f\' to skip validation');
            return;
          }
        }
        pack(...inputList);
      } catch (error: any) {
        console.log(error.message);
      }
    });
}
