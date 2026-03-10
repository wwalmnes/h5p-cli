import { Command } from 'commander';

export function packCommand(): Command {
  return new Command('pack')
    .description('Packs the given libraries')
    .argument('<libraries...>', 'Library names (last arg can be output .h5p file)')
    .option('-r', 'Recursive packaging')
    .option('-f', 'Skip library validation')
    .action(async (libraries: string[], options: { r?: boolean; f?: boolean }) => {
      const pack = require('../../../assets/utils/commands/pack.js') as any;
      const validate = require('../../../assets/utils/commands/validate.js') as any;
      const Input = require('../../../assets/utils/utility/input.js') as any;

      const inputList: string[] = [];
      if (options.r) inputList.push('-r');
      if (options.f) inputList.push('-f');
      inputList.push(...libraries);

      try {
        const input = new Input(inputList);
        if (!input.hasFlag('-f')) {
          const result = await validate.apply(null, inputList);
          const notValid = result.some((item: any) => item.status !== 'ok');
          if (notValid) {
            console.log('validation failed; use \'-f\' to skip validation');
            return;
          }
        }
        pack.apply(null, inputList);
      } catch (error: any) {
        console.log(error.message);
      }
    });
}
