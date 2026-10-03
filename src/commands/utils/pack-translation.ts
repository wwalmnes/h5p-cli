import { Command } from 'commander';
import { packTranslation } from '../../translations/translations.ts';
import { ui } from '../../ui/ui.ts';

export function packTranslationCommand(): Command {
  return new Command('pack-translation')
    .description('Export translations')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library names (last arg can be output .zip file)')
    .action(async (languageCode: string, libraries: string[]) => {
      const zipPattern = /\.zip$/;
      let file = 'translations.zip';
      const zipIdx = libraries.findIndex(l => zipPattern.test(l));
      if (zipIdx !== -1) file = libraries.splice(zipIdx, 1)[0];

      try {
        const repos = libraries.length ? libraries : ['*'];
        const count = await packTranslation(languageCode, repos, file);
        ui.success(`Successfully packed ${count} translations into ${file}`);
      } catch (error) {
        ui.fail(error);
      }
    });
}
