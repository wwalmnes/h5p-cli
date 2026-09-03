import { Command } from 'commander';
import buildLibraries from '../../utils/commands/build-libraries.ts';
import { ui } from '../../lib/ui.ts';

export function buildCommand(): Command {
  return new Command('build')
    .description('Installs dependencies, builds libraries and runs tests')
    .argument('<libraries...>', 'Library names')
    .option('-t, --test', 'Run tests')
    .option('-i, --install', 'Install dependencies before building')
    .action(async (libraries: string[], options: { test?: boolean; install?: boolean }) => {
      try {
        await buildLibraries(libraries, { test: options.test, install: options.install });
      } catch (error) {
        ui.fail(error);
      }
    });
}
