import { ui } from '../../lib/ui.ts';
import { reportResult } from '../../lib/repo-report.ts';
import * as translation from '../utility/translation.ts';

export type CheckTranslationsOptions = {
  diff?: boolean;
};

const checkTranslations = async function (
  libraries: string[],
  languages: string[],
  options: CheckTranslationsOptions = {}
): Promise<void> {
  const result = await translation.validateTranslation(libraries, languages);

  let ok = true;
  for (const lib of result) {
    for (const comp of lib) {
      outputComparison(options.diff ?? false, comp);
      if (comp.failed) {
        ok = false;
      }
    }
  }

  if (!ok) {
    throw new Error('translations do not match');
  }
};

const outputComparison = (diff: boolean, comparison: any): void => {
  reportResult(comparison);
  if (diff && Array.isArray(comparison.errors)) {
    comparison.errors.forEach((err: string) => {
      ui.error(err);
    });
  }
};

export default checkTranslations;
