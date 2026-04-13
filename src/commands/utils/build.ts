import { Command } from 'commander';
import buildLibraries from '../../utils/commands/build-libraries.ts';

export function buildCommand(): Command {
  return new Command('build')
    .description('Installs dependencies, builds libraries and runs tests')
    .argument('<libraries...>', 'Library names')
    .option('-t', 'Run tests')
    .action((libraries: string[], options: { t?: boolean }) => {
      const args: string[] = [];
      if (options.t) args.push('-t');
      args.push(...libraries);
      buildLibraries(...args);
    });
}
