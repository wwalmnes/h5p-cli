import { getLibraryData, getLanguageData } from './repository.ts';
import { reportResult } from '../../lib/repo-report.ts';
import path from 'path';
import { createDefaultLanguage } from '../../lib/semantics-utils.ts';
import fs from 'fs';
import sanitizeHtml from 'sanitize-html';
import { ui } from '../../lib/ui.ts';

export function languageComparison(language: any, assertLanguage: any, errors?: string[]): { hasValidJson: boolean; errors: string[] } {
  let hasValidJson = true;
  errors = errors || [];

  if (Object.keys(language).length !== Object.keys(assertLanguage).length) {
    hasValidJson = false;
    errors.push('Not same number of fields');
  }
  else {
    for (const translation in assertLanguage) {
      if (assertLanguage.hasOwnProperty(translation) && typeof assertLanguage[translation] === 'string') {
        if (translation.indexOf('english') !== 0) {
          const isString = typeof language[translation] === 'string';
          const isSafe = isSafeTranslation(language[translation]);
          const isEmptyString = isString && language[translation].trim().length === 0;
          hasValidJson = hasValidJson && isString && isSafe && !isEmptyString;

          if (isString && language[translation].trim().length === 0) {
            errors.push("Empty field", translation);
          }

          if (!isString) {
            errors.push("Mismatch:", translation, JSON.stringify(assertLanguage, null, 2), JSON.stringify(language, null, 2));
          }

          if (!isSafe) {
            errors.push("Unsafe translation", language[translation]);
          }
        }
      }
      else {
        if (!language[translation]) {
          errors.push("Could not find field:", translation, JSON.stringify(language, null, 2), JSON.stringify(assertLanguage, null, 2));
        }
        else {
          if(Object.keys(language[translation]).length !== Object.keys(assertLanguage[translation]).length) {
            hasValidJson = false;
            errors.push("Mismatch:", translation);
          }
          else {
            const validGroup = languageComparison(language[translation], assertLanguage[translation], errors);
            hasValidJson = hasValidJson && validGroup.hasValidJson;
          }
        }
      }
    }
  }

  return {
    hasValidJson,
    errors
  };
}

export function validateLanguage(library: string, language: string): any {
  const testLang = getLanguageData(library, language);
  const defaultLangSemantics = createDefaultLanguage(library);

  if (typeof testLang === 'object' && testLang.semantics) {
    const validation = languageComparison(testLang.semantics, defaultLangSemantics);

    return {
      name: `${library} language ${language}`,
      failed: !validation.hasValidJson,
      errors: validation.errors
    };
  }
  else {
    return {
      name: `${library} language ${language}`,
      skipped: true
    };
  }
}

function getLanguages(languages: string[], lib: string): Promise<any[]> {
  if (languages.length) {
    return Promise.resolve(
      languages.map(validateLanguage.bind(null, lib))
    );
  }
  else {
    return getAllLanguagesOfLib(lib);
  }
}

const getLanguageCode = (dir: string): string => dir.split('.')[0];

function getAllLanguagesOfLib(lib: string): Promise<any[]> {
  return Promise.resolve(fs.readdirSync(path.resolve(lib, 'language')) as string[])
    .then((dirs: string[]) => dirs.map(getLanguageCode).map(validateLanguage.bind(null, lib)))
    .catch(() => {
      reportResult({
        name: lib,
        skipped: true
      });
      return [];
    });
}

export function validateTranslation(libraries: string[], languages: string[]): Promise<any[]> {
  const librariesMap = libraries.map(getLanguages.bind(null, languages));
  return Promise.all(librariesMap);
}

export function compareEditorLanguageFile(defaults: any, translation: any): boolean {
  if (defaults.libraryStrings === undefined || translation.libraryStrings === undefined) {
    return false;
  }

  defaults = defaults.libraryStrings;
  translation = translation.libraryStrings;

  if (Object.keys(defaults).length !== Object.keys(translation).length) {
    return false;
  }

  let valid = true;
  Object.keys(defaults).forEach(key => {
    if (translation[key] === undefined) {
      valid = false;
    }
    else if (!isSafeTranslation(translation[key])) {
      ui.warn('Unsafe translation: ' + translation[key]);
      valid = false;
    }
  });

  return valid;
}

/** Check if translation is safe */
export function isSafeTranslation(translation: string): boolean {
  const sanitized = sanitizeHtml(translation, {
    allowedClasses: {
      table: ['h5p-table'],
    },
    allowedAttributes: {
      th: ['scope'],
      a: ['target', 'href']
    }
  });

  return translation === sanitized;
}

export function getEditorLanguageDefaults(libraryDir: string): any {
  return JSON.parse(fs.readFileSync(`${libraryDir}/language/en.json`).toString());
}
