import fs from 'fs';
import { getLibraryData, isEditorLibrary } from '../utility/repository';
import { compareEditorLanguageFile, getEditorLanguageDefaults, languageComparison } from '../utility/translation';
import Input from '../utility/input';
import parallel from '../utility/parallel';
import h5p from '../h5p';
import path from 'path';

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
      console.log(error.message);
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
    console.log(JSON.stringify(results, null, 2));
  }
};

const validateLibrary = (library: string, done: (results: any) => void): void => {
  const libraryDir = process.cwd() + '/' + library;
  const libraryJson = getLibraryData(libraryDir);
  const results: any = {
    'library': library
  };

  validateLanguageFiles(libraryDir, libraryJson, function (langResults: any) {
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

const validateLanguageFiles = (libraryDir: string, libraryJson: any, done: (results: any) => void): void => {
  const results: any = {};
  const fileNames: any = {};
  const languageDir = libraryDir + '/language/';

  if (!fs.existsSync(languageDir)) {
    return done(results);
  }

  const isEditorLib = isEditorLibrary(libraryJson);
  const languageFiles = fs.readdirSync(languageDir);

  for (let i = 0; i < languageFiles.length; i++) {
    const file = languageFiles[i];
    const languageCode = path.basename(file, '.json').trim();

    if (languageCode !== languageCode.toLowerCase()) {
      results[file] = {
        status: ERROR,
        message: 'Language file name must be lowercase: ' + file
      };
      continue;
    }
    if (languageCode.length < 2 || languageCode.length > 7) {
      results[file] = {
        status: ERROR,
        message: 'Invalid language file name (must be between 2 and 7 characters): ' + file
      };
      continue;
    }
    if (!isEditorLib && file === 'en.json') {
      results[file] = {
        status: ERROR,
        message: 'en.json is not allowed'
      };
      continue;
    }
    else {
      fileNames[file] = languageDir + file;
    }
  }

  if (Object.keys(fileNames).length === 0) {
    return done(results);
  }

  if (isEditorLib) {
    const editorDefaults = getEditorLanguageDefaults(libraryDir);

    h5p.readJSONFiles(fileNames, function (files: any) {
      Object.keys(files).forEach(function (fileName) {
        if(!compareEditorLanguageFile(editorDefaults, files[fileName].content)) {
          results[fileName] = {
            status: ERROR,
            message: 'Language file does not match editor defaults'
          };
        }
        else {
          results[fileName] = {
            status: OK
          };
        }
      });
      done(results);
    });
  }
  else {
    h5p.readJSONFiles(fileNames, function (files: any) {
      const defaultLangSemantics = h5p.createDefaultLanguage(libraryDir);

      Object.keys(files).forEach((filename: string) => {
        const testLang = files[filename].content;
        if (typeof testLang === 'object' && testLang.semantics) {
          const validation = languageComparison(testLang.semantics, defaultLangSemantics);

          results[filename] = {
            status: validation.hasValidJson ? OK : ERROR,
            message: validation.hasValidJson ? undefined : validation.errors
          };
        }
        else {
          results[filename] = {
            status: ERROR,
            message: 'Empty/invalid language file'
          };
        }
      });
      done(results);
    });
  }
};

export default validate;
