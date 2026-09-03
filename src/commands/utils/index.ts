import { Command } from 'commander';
import { enforce, requireLibrariesCwd } from '../../lib/workspace.ts';
import { initCommand } from './init.ts';
import { utilsHelpCommand } from './help.ts';
import { utilsListCommand } from './list.ts';
import { getCommand } from './get.ts';
import { packCommand } from './pack.ts';
import { increasePatchVersionCommand } from './increase-patch-version.ts';
import { tagVersionCommand } from './tag-version.ts';
import { changesSinceCommand } from './changes-since.ts';
import { changesSinceReleaseCommand } from './changes-since-release.ts';
import { compareTagsWithReleaseCommand } from './compare-tags-with-release.ts';
import { commitsSinceCommand } from './commits-since.ts';
import { createLanguageFileCommand } from './create-language-file.ts';
import { importLanguageFilesCommand } from './import-language-files.ts';
import { addEnglishTextsCommand } from './add-english-texts.ts';
import { copyTranslationCommand } from './copy-translation.ts';
import { packTranslationCommand } from './pack-translation.ts';
import { dependencyCheckCommand } from './dependency-check.ts';
import { findInconsistenciesCommand } from './find-inconsistencies.ts';
import { checkTranslationsCommand } from './check-translations.ts';
import { buildCommand } from './build.ts';
import { updateTranslationsCommand } from './update-translations.ts';
import { validateCommand } from './validate.ts';
import { bumpCommand } from './bump.ts';

export function utilsCommand(): Command {
  const utils = new Command('utils');
  utils.description('Utility commands for H5P library management');

  // Most utils sweep the checkouts in cwd, so they run from inside `libraries/`. `list` and
  // `help` touch no files, and `get`/`init` create the checkouts, so cwd may still be empty.
  // `find-inconsistencies` scans a folder of checkouts given by `--libraries` and never
  // shells out to git, so requiring a git repo in cwd would only get in its way.
  const cwdExempt = ['list', 'help', 'get', 'init', 'find-inconsistencies'];
  utils.hook('preAction', (_thisCommand, actionCommand) => {
    const name = actionCommand.name();
    if (!cwdExempt.includes(name)) {
      enforce(() => requireLibrariesCwd(`utils ${name}`));
    }
  });

  utils.addCommand(initCommand());
  utils.addCommand(utilsHelpCommand());
  utils.addCommand(utilsListCommand());
  utils.addCommand(getCommand());
  utils.addCommand(packCommand());
  utils.addCommand(increasePatchVersionCommand());
  utils.addCommand(tagVersionCommand());
  utils.addCommand(changesSinceCommand());
  utils.addCommand(changesSinceReleaseCommand());
  utils.addCommand(compareTagsWithReleaseCommand());
  utils.addCommand(commitsSinceCommand());
  utils.addCommand(createLanguageFileCommand());
  utils.addCommand(importLanguageFilesCommand());
  utils.addCommand(addEnglishTextsCommand());
  utils.addCommand(copyTranslationCommand());
  utils.addCommand(packTranslationCommand());
  utils.addCommand(dependencyCheckCommand());
  utils.addCommand(findInconsistenciesCommand());
  utils.addCommand(checkTranslationsCommand());
  utils.addCommand(buildCommand());
  utils.addCommand(updateTranslationsCommand());
  utils.addCommand(validateCommand());
  utils.addCommand(bumpCommand());

  return utils;
}
