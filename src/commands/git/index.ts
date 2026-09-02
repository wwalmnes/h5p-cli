import { Command } from 'commander';
import { statusCommand } from './status.ts';
import { diffCommand } from './diff.ts';
import { commitCommand } from './commit.ts';
import { pullCommand } from './pull.ts';
import { pushCommand } from './push.ts';
import { checkoutCommand } from './checkout.ts';
import { newBranchCommand } from './new-branch.ts';
import { rmBranchCommand } from './rm-branch.ts';
import { mergeCommand } from './merge.ts';
import { tagCommand } from './tag.ts';

export function gitCommand(): Command {
  const git = new Command('git');
  git.description('Multi-repo git operations across H5P libraries');

  git.addCommand(statusCommand());
  git.addCommand(diffCommand());
  git.addCommand(commitCommand());
  git.addCommand(pullCommand());
  git.addCommand(pushCommand());
  git.addCommand(checkoutCommand());
  git.addCommand(newBranchCommand());
  git.addCommand(rmBranchCommand());
  git.addCommand(mergeCommand());
  git.addCommand(tagCommand());

  return git;
}
