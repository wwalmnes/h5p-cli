import fs from 'fs';
import { getLibraryData, isEditorLibrary } from '../utility/repository.ts';
import { compareEditorLanguageFile, getEditorLanguageDefaults, languageComparison } from '../utility/translation.ts';
import Input from '../utility/input.ts';
import parallel from '../utility/parallel.ts';
import { createDefaultLanguage } from '../../lib/semantics-utils.ts';
import path from 'path';
import { ui } from '../../lib/ui.ts';

async function readJSONFiles(fileNames: Record<string, string>): Promise<Record<string, { file: string; error: any; content: any }>> {
  const entries = await Promise.all(
    Object.entries(fileNames).map(async ([key, filePath]) => {
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return [key, { file: filePath, error: null, content }] as const;
      } catch (err) {
        return [key, { file: filePath, error: err, content: null }] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

const ERROR = 'error';
const WARNING = 'warning';
const OK = 'ok';

const validate = function (...inputList: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const input = new Input(inputList);
    input.init().then(() => {
      const libraries = input.getLibraries();
      if (libraries.length === 0) {
        reject(new Error('no valid libraries found; use \'-f\' to skip validation'));
      }
      parallel(libraries, (index, library, done) => {
        validateLibrary(library, done);
      }, (error, results) => {
        outputReport(results);
        resolve(results);
      });
    })
    .catch((error: any) => {
      ui.error(error);
    });
  });
};

const outputReport = (results: any[]): void => {
  results = results.filter(library => library.status !== OK);

  results.forEach((library) => {
    Object.keys(library.language).forEach((key) => {
      if (library.language[key].status === OK) {
        delete library.language[key];
      }
    });
  });

  if (results.length > 0) {
    ui.data(JSON.stringify(results, null, 2));
  }
};

const validateLibrary = (library: string, done: (results: any) => void): void => {
  const libraryDir = process.cwd() + '/' + library;
  const libraryJson = getLibraryData(libraryDir);
  const results: any = { 'library': library };

  validateLanguageFiles(libraryDir, libraryJson).then((langResults: any) => {
    results.status = getHighestSeverity(langResults);
    results.language = langResults;
    done(results);
  });
};

const getHighestSeverity = (list: any): string => {
  let highest = OK;
  const elements = Object.values(list) as any[];

  for (let i = 0; i < elements.length; i++) {
    if (elements[i].status === ERROR) {
      return ERROR;
    }

    if (elements[i].status === WARNING) {
      highest = WARNING;
    }
  }

  return highest;
};

async function validateLanguageFiles(libraryDir: string, libraryJson: any): Promise<any> {
  const results: any = {};
  const fileNames: Record<string, string> = {};
  const languageDir = libraryDir + '/language/';

  if (!fs.existsSync(languageDir)) return results;

  const isEditorLib = isEditorLibrary(libraryJson);
  const languageFiles = fs.readdirSync(languageDir);

  for (const file of languageFiles) {
    const languageCode = path.basename(file, '.json').trim();

    if (languageCode !== languageCode.toLowerCase()) {
      results[file] = { status: ERROR, message: 'Language file name must be lowercase: ' + file };
      continue;
    }
    if (languageCode.length < 2 || languageCode.length > 7) {
      results[file] = { status: ERROR, message: 'Invalid language file name (must be between 2 and 7 characters): ' + file };
      continue;
    }
    if (!isEditorLib && file === 'en.json') {
      results[file] = { status: ERROR, message: 'en.json is not allowed' };
      continue;
    } else {
      fileNames[file] = languageDir + file;
    }
  }

  if (Object.keys(fileNames).length === 0) return results;

  const files = await readJSONFiles(fileNames);

  if (isEditorLib) {
    const editorDefaults = getEditorLanguageDefaults(libraryDir);
    for (const fileName of Object.keys(files)) {
      results[fileName] = compareEditorLanguageFile(editorDefaults, files[fileName].content)
        ? { status: OK }
        : { status: ERROR, message: 'Language file does not match editor defaults' };
    }
  } else {
    const defaultLangSemantics = createDefaultLanguage(libraryDir);
    for (const filename of Object.keys(files)) {
      const testLang = files[filename].content;
      if (typeof testLang === 'object' && testLang.semantics) {
        const validation = languageComparison(testLang.semantics, defaultLangSemantics);
        results[filename] = {
          status: validation.hasValidJson ? OK : ERROR,
          message: validation.hasValidJson ? undefined : validation.errors
        };
      } else {
        results[filename] = { status: ERROR, message: 'Empty/invalid language file' };
      }
    }
  }

  return results;
}

export default validate;
