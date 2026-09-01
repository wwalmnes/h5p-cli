import fs from 'fs';
import { Command } from 'commander';
import { setupFolders } from './lib/setup-folders.ts';
import { loadPlugins } from './lib/plugin-loader.ts';
import { ui } from './lib/ui.ts';
import { exportCommand } from './commands/export.ts';
import { importCommand } from './commands/import.ts';
import { listCommand } from './commands/list.ts';
import { tagsCommand } from './commands/tags.ts';
import { depsCommand } from './commands/deps.ts';
import { missingCommand } from './commands/missing.ts';
import { installCommand } from './commands/install.ts';
import { cloneCommand } from './commands/clone.ts';
import { coreCommand } from './commands/core.ts';
import { setupCommand } from './commands/setup.ts';
import { branchesCommand } from './commands/branches.ts';
import { registerCommand } from './commands/register.ts';
import { verifyCommand } from './commands/verify.ts';
import { serverCommand } from './commands/server.ts';
import { createCommand } from './commands/create.ts';
import { pluginCommand } from './commands/plugin.ts';
import { gitCommand } from './commands/git/index.ts';
import { utilsCommand } from './commands/utils/index.ts';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const program = new Command();

program
  .name('h5p')
  .description('A tool for developing & testing H5P content types')
  .version(pkg.version)
  .option('--verbose', 'Show subprocess output and error stacks')
  .option('--quiet', 'Only show warnings and errors');

// Global flags must precede the subcommand (`h5p --verbose install …`);
// H5P_VERBOSE / H5P_QUIET work anywhere and are read by ui as the fallback.
program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts();
  if (options.verbose) ui.setLevel('verbose');
  else if (options.quiet) ui.setLevel('quiet');
});

program.addCommand(exportCommand());
program.addCommand(importCommand());
program.addCommand(listCommand());
program.addCommand(tagsCommand());
program.addCommand(depsCommand());
program.addCommand(missingCommand());
program.addCommand(installCommand());
program.addCommand(cloneCommand());
program.addCommand(coreCommand());
program.addCommand(setupCommand());
program.addCommand(branchesCommand());
program.addCommand(registerCommand());
program.addCommand(verifyCommand());
program.addCommand(serverCommand());
program.addCommand(createCommand());
program.addCommand(pluginCommand());
program.addCommand(gitCommand());
program.addCommand(utilsCommand());

await loadPlugins(program);

// Replicate the original guard: skip setupFolders for 'utils', 'git', 'help', 'plugin', no-arg
const subcommandName = process.argv[2];
if (subcommandName && !['utils', 'git', 'help', '--help', '-h', '--version', '-V', 'plugin'].includes(subcommandName)) {
  // setupFolders();
}

program.parse(process.argv);
