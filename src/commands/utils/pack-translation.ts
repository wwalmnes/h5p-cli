import { Command } from 'commander';
import h5p from '../../utils/h5p';

export function packTranslationCommand(): Command {
  return new Command('pack-translation')
    .description('Export translations')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library names (last arg can be output .zip file)')
    .action((languageCode: string, libraries: string[]) => {
      const lf = '\u000A';

      // Extract optional zip file from end of libraries list
      const zipPattern = /\.zip$/;
      let file = 'translations.zip';
      const zipIdx = libraries.findIndex(l => zipPattern.test(l));
      if (zipIdx !== -1) {
        file = libraries.splice(zipIdx, 1)[0];
      }

      h5p.packTranslation(languageCode, libraries, file, function (error: any, resultList: any[]) {
        if (error) {
          process.stderr.write(error + lf);
        } else {
          let num = 0;
          for (let i = 0; i < resultList.length; i++) {
            if (resultList[i]) num += 1;
          }
          process.stdout.write('Successfully packed ' + num + ' translations into ' + file + lf);
        }
      });
    });
}
