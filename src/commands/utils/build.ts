import { Command } from 'commander';

export function buildCommand(): Command {
  return new Command('build')
    .description('Installs dependencies, builds libraries and runs tests')
    .argument('<libraries...>', 'Library names')
    .option('-t', 'Run tests')
    .action((libraries: string[], options: { t?: boolean }) => {
      const buildLibraries = require('../../../assets/utils/commands/build-libraries.js') as any;
      const args: string[] = [];
      if (options.t) args.push('-t');
      args.push(...libraries);
      buildLibraries.apply(null, args);
    });
}
