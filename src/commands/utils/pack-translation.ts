import { Command } from 'commander';
import { packTranslation } from '../../translations/translations.ts';
import { ui } from '../../ui/ui.ts';

export function packTranslationCommand(): Command {
  return new Command('pack-translation')
    .description('Export translations')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (last arg can be output .zip file)')
    .addHelpText('after', `
Examples:
  $ h5p utils pack-translation nb h5p-accordion h5p-blanks nb.zip`)
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
