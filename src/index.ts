import { Command } from 'commander';
import { setupFolders } from './lib/setup-folders';
import { loadPlugins } from './lib/plugin-loader';
import { exportCommand } from './commands/export';
import { importCommand } from './commands/import';
import { listCommand } from './commands/list';
import { tagsCommand } from './commands/tags';
import { depsCommand } from './commands/deps';
import { missingCommand } from './commands/missing';
import { installCommand } from './commands/install';
import { cloneCommand } from './commands/clone';
import { coreCommand } from './commands/core';
import { setupCommand } from './commands/setup';
import { branchesCommand } from './commands/branches';
import { registerCommand } from './commands/register';
import { verifyCommand } from './commands/verify';
import { serverCommand } from './commands/server';
import { createCommand } from './commands/create';
import { pluginCommand } from './commands/plugin';
import { utilsCommand } from './commands/utils/index';

const pkg = require('../package.json');

const program = new Command();

program
  .name('h5p')
  .description('A tool for developing & testing H5P content types')
  .version(pkg.version);

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
program.addCommand(utilsCommand());

loadPlugins(program);

// Replicate the original guard: skip setupFolders for 'utils', 'help', 'plugin', no-arg
const subcommandName = process.argv[2];
if (subcommandName && !['utils', 'help', '--help', '-h', '--version', '-V', 'plugin'].includes(subcommandName)) {
  setupFolders();
}

program.parse(process.argv);
