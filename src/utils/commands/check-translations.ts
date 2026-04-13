import * as output from '../utility/output.ts';
import Input from '../utility/input.ts';
import * as translation from '../utility/translation.ts';

const checkTranslations = function (...inputList: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = new Input(inputList);
    const diff = input.hasFlag('-diff');
    input.init()
      .then(() => {
        let ok = true;
        const libraries = input.getLibraries();
        const languages = input.getLanguages();
        translation.validateTranslation(libraries, languages)
          .then((result) => {
            for (const lib of result) {
              for (const comp of lib) {
                outputComparison(diff, comp);
                if (comp.failed) {
                  ok = false;
                }
              }
            }
            if (ok) {
              resolve();
            }
            else {
              reject();
            }
          });
      });
  });
};

const outputComparison = (diff: boolean, comparison: any): void => {
  output.printResults(comparison);
  if (diff && Array.isArray(comparison.errors)) {
    comparison.errors.forEach((err: string) => {
      output.printError(err);
    });
  }
};

export default checkTranslations;
