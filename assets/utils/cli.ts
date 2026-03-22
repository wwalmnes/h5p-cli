import h5p from './h5p';
import pack from './commands/pack';
import statusCmd from './commands/status';
import pull from './commands/pull';
import init from './commands/init';
import checkTranslations from './commands/check-translations';
import buildLibraries from './commands/build-libraries';
import validate from './commands/validate';
import bump from './commands/bump';
import Input from './utility/input';

const lf = '\u000A';
const cr = '\u000D';
const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m'
};

const noCr = (process.platform === 'win32');

function Spinner(this: any, prefix: string) {
  let interval: ReturnType<typeof setInterval>;

  if (noCr) {
    this.stop = function (result: string) {
      clearInterval(interval);
      process.stdout.write(' ' + result);
    };

    process.stdout.write(prefix);
    interval = setInterval(function () {
      process.stdout.write('.');
    }, 500);
  }
  else {
    const parts = ['/','-','\\', '|'];
    let curPos = 0;
    const maxPos = parts.length;

    this.stop = function (result: string) {
      clearInterval(interval);
      process.stdout.write(cr + prefix + ' ' + result);
    };

    interval = setInterval(function () {
      process.stdout.write(cr + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
      if (curPos === maxPos) curPos = 0;
    }, 100);
  }
}

function clone(fetchWithHttps: boolean) {
  const name = h5p.clone(fetchWithHttps, function (error: any) {
    let result: string;
    if (error === -1) {
      result = color.yellow + 'SKIPPED' + color.default + lf;
    }
    else if (error) {
      result = color.red + 'FAILED' + color.default + lf + error;
    }
    else {
      result = color.green + 'OK' + color.default + lf;
    }

    spinner.stop(result);
    clone(fetchWithHttps);
  });
  if (!name) return;
  const msg = 'Cloning into \'' + color.emphasize + name + color.default + '\'...';
  const spinner = new (Spinner as any)(msg);
}

function push(options: any) {
  h5p.pushAll(options)
    .then((result: any[]) => {
      spinner.stop("done\n");
      for (let i = 0; i < result.length; i++) {
        console.log(result[i].status);
        console.log(result[i].reason);
      }
    })
    .catch((error: any) => {
      spinner.stop(error.toString());
    });
  const msg = 'Pushing \'' + color.emphasize + 'all repos' + color.default + '\'...';
  const spinner = new (Spinner as any)(msg);
}

function results(error: any, repos: any[]) {
  if (error) return process.stdout.write(error + lf);

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];

    process.stdout.write(color.emphasize + repo.name + color.default);

    if (repo.failed) {
      process.stdout.write(' ' + color.red + 'FAILED' + color.default);
    }
    else if (repo.skipped) {
      process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
    }
    else {
      process.stdout.write(' ' + color.green + 'OK' + color.default);
    }

    if (repo.msg) {
      process.stdout.write(' ' + repo.msg);
    }

    process.stdout.write(lf);
  }
}

function handleChanges(error: any, changes: any[]) {
  if (error) return process.stdout.write(error + lf);

  function printLibChanges(libName: string, detailsColor?: string, details?: string) {
    const detailsOutput = details && detailsColor ? (color as any)[detailsColor] + details + color.default : '';
    process.stdout.write(color.emphasize + libName + color.default + ' ' + detailsOutput + lf);
  }

  for (let i = 0; i < changes.length; i++) {
    const lib = changes[i];

    if (lib.skipped) {
      printLibChanges(lib.name, 'yellow', lib.msg);
    }
    else if (lib.failed && lib.msg && lib.msg.error) {
      printLibChanges(lib.name);

      if (lib.msg.output) {
        process.stdout.write(lib.msg.output + lf);
      }

      process.stdout.write(color.red + lib.msg.error + color.default + lf);
    }
    else if (lib.failed) {
      printLibChanges(lib.name, 'red', lib.msg);
    }
    else if (lib.msg && lib.msg.version && lib.msg.changes) {
      printLibChanges(lib.name, 'green', lib.msg.version);
      process.stdout.write(lib.msg.changes + lf);
    }
    else if (lib.msg && lib.msg.changes) {
      printLibChanges(lib.name);
      process.stdout.write(lib.msg.changes + lf);
    }
  }
}

function commit(error: any, results: any[]) {
  if (error) return process.stdout.write(error + lf);

  let first = true;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (!result.error && !result.changes) continue;

    if (first) {
      process.stdout.write(lf);
      first = false;
    }

    process.stdout.write(color.emphasize + result.name + color.default);
    if (result.branch && result.commit) {
      process.stdout.write(' (' + result.branch + ' ' + result.commit + ')');
    }
    process.stdout.write(lf);

    if (result.error) {
      process.stdout.write(error + lf);
    }
    else {
      process.stdout.write(result.changes.join(lf) + lf);
    }
    process.stdout.write(lf);
  }
}

function filterOptions(inputs: string[], valids: any[]): string[] {
  const options: string[] = [];

  for (let i = 0; i < inputs.length; i++) {
    for (let j = 0; j < valids.length; j++) {
      if (valids[j] instanceof RegExp && valids[j].test(inputs[i]) ||
          valids[j] === inputs[i]) {
        options.push(inputs[i]);
        inputs.splice(i, 1);
        i--;
      }
    }
  }

  return options;
}

function progress(action: string) {
  let spinner: any;
  return function (status: any, nextRepo: string) {
    if (status) {
      if (status.failed) {
        spinner.stop(color.red + 'FAILED' + color.default + lf + status.msg);
      }
      else if (status.skipped) {
        spinner.stop(color.yellow + 'SKIPPED' + color.default + lf);
      }
      else {
        spinner.stop(color.green + 'OK' + color.default + (status.msg === undefined ? '' : ' ' + status.msg) + lf);
      }
    }

    if (nextRepo) {
      spinner = new (Spinner as any)(action + ' \'' + color.emphasize + nextRepo + color.default + '\'...');
    }
  };
}

const commands: any[] = [
  {
    name: 'init',
    handler: init
  },
  {
    name: 'help',
    handler: function (command: string) {
      if (command) {
        const cmd = findCommand(command);
        if (cmd && cmd.description) {
          process.stdout.write(cmd.description + lf);
        }
        else {
          process.stdout.write('Sorry, no help available.' + lf);
        }
      }
      else {
        listCommands();
      }
    }
  },
  {
    name: 'list',
    handler: function () {
      const spinner = new (Spinner as any)('Getting library list...');
      h5p.list(function (error: any, libraries: any) {
        const result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
        spinner.stop(result + lf);

        for (const name in libraries) {
          process.stdout.write('  ' + color.emphasize + name + color.default + lf);
        }
      });
    }
  },
  {
    name: 'get',
    handler: function () {
      const inputs = Array.prototype.slice.call(arguments);
      const fetchWithHttps = inputs[0] === "--https";
      let libraries = inputs;
      if(fetchWithHttps) {
        libraries = inputs.slice(1);
      }
      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }
      const spinner = new (Spinner as any)('Looking up dependencies...');
      h5p.get(libraries, function (error: any) {
        const result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
        spinner.stop(result + lf);
        clone(fetchWithHttps);
      });
    }
  },
  {
    name: 'status',
    handler: statusCmd
  },
  {
    name: 'commit',
    handler: function () {
      const args = [...arguments as any];
      const msg = args.shift();
      if (!msg) {
        process.stdout.write('No message means no commit.' + lf);
        return;
      }
      if (msg.split(' ', 2).length < 2) {
        process.stdout.write('Commit message to short.' + lf);
        return;
      }
      const libraries = Array.prototype.slice.call(args);
      h5p.commitRepos(msg, libraries, commit);
    }
  },
  {
    name: 'pull',
    handler: pull
  },
  {
    name: 'push',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const options = filterOptions(libraries, ['--tags']);
      h5p.update(libraries, (error: any) => {
        if (error) return process.stdout.write(error + lf);
        push(options);
      });
    }
  },
  {
    name: 'checkout',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const branch = libraries.shift();
      if (!branch) {
        process.stdout.write('No branch today.' + lf);
        return;
      }
      h5p.checkoutAll(branch, libraries, results);
    }
  },
  {
    name: 'new-branch',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const branch = libraries.shift();
      if (!branch || branch.substr(0, 4) === 'h5p-') {
        process.stdout.write('That is a strange name for a branch..' + lf);
        return;
      }
      h5p.newBranch(branch, libraries, progress('Branching'));
    }
  },
  {
    name: 'rm-branch',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const branch = libraries.shift();
      if (!branch || branch.substr(0, 4) === 'h5p-' || branch === 'master') {
        process.stdout.write('I would think twice about doing that!' + lf);
        return;
      }
      h5p.rmBranch(branch, libraries, progress('De-branching'));
    }
  },
  {
    name: 'diff',
    handler: function () {
      h5p.diff(function (error: any, diff: string) {
        if (error) return process.stdout.write(color.red + 'ERROR!' + color.default + lf + error);
        process.stdout.write(diff);
      });
    }
  },
  {
    name: 'merge',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const branch = libraries.shift();
      if (!branch) {
        process.stdout.write('No branch today.' + lf);
        return;
      }
      h5p.mergeAll(branch, libraries, results);
    }
  },
  {
    name: 'pack',
    handler: async (...inputList: string[]) => {
      try {
        const input = new Input(inputList);
        if (!input.hasFlag('-f')) {
          const result = await validate(...inputList);
          const notValid = result.some((item) => item.status !== 'ok');
          if (notValid) {
            console.log('validation failed; use \'-f\' to skip validation');
            return;
          }
        }
        pack(...inputList);
      }
      catch (error: any) {
        console.log(error.message);
      }
    }
  },
  {
    name: 'increase-patch-version',
    handler: function () {
      let force: boolean, libraries: string[] = Array.prototype.slice.call(arguments);
      if (libraries[0] === '-f') {
        force = true;
        libraries.splice(0, 1);
      }
      h5p.increasePatchVersion(force!, libraries, results);
    }
  },
  {
    name: 'tag-version',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      h5p.tagVersionAll(libraries, results);
    }
  },
  {
    name: 'tag',
    handler: function () {
      const inputs = Array.prototype.slice.call(arguments);
      const tagName = inputs.splice(0,1);
      const libraries = inputs;
      h5p.tagAll(tagName, libraries, results);
    }
  },
  {
    name: 'changes-since',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      let versions = 1;
      if (libraries[0] && libraries[0].match(/^-?\d+$/ig)) {
        versions = Math.abs(parseInt(libraries.splice(0, 1)[0]));
      }
      h5p.changesSinceAll(versions, libraries, handleChanges);
    }
  },
  {
    name: 'changes-since-release',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      h5p.changesSinceReleaseAll(libraries, handleChanges);
    }
  },
  {
    name: 'compare-tags-with-release',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      h5p.compareTagsReleaseAll(libraries, handleChanges);
    }
  },
  {
    name: 'commits-since',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      let versions = 1;
      if (libraries[0] && libraries[0].match(/^-?\d+$/ig)) {
        versions = Math.abs(parseInt(libraries.splice(0, 1)[0]));
      }
      h5p.commitsSinceAll(versions, libraries, handleChanges);
    }
  },
  {
    name: 'create-language-file',
    handler: function (library: string, languageCode: string) {
      if (!library) {
        process.stdout.write('No library selected.' + lf);
        return;
      }
      if (!languageCode) {
        process.stdout.write('No language selected.' + lf);
        return;
      }
      h5p.createLanguageFile(library, languageCode, results);
    }
  },
  {
    name: 'import-language-files',
    handler: function (dir: string) {
      if (!dir) {
        process.stdout.write('No dir selected.' + lf);
        return;
      }
      h5p.importLanguageFiles(dir, results);
    }
  },
  {
    name: 'add-english-texts',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      let populateFlag = libraries.splice(0, 1)[0];
      let languageCode: string;
      const hasPopulateFlag = populateFlag === '-P';
      if (hasPopulateFlag) {
        languageCode = libraries.splice(0, 1)[0];
      }
      else {
        languageCode = populateFlag;
      }
      if (!languageCode) {
        process.stdout.write('No language specified.' + lf);
        return;
      }
      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }
      h5p.addOriginalTexts(languageCode, libraries, results, hasPopulateFlag);
    }
  },
  {
    name: 'copy-translation',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const from = libraries.splice(0, 1)[0];
      const to = libraries.splice(0, 1)[0];
      if (!from) {
        process.stdout.write('No language source specified.' + lf);
        return;
      }
      if (!to) {
        process.stdout.write('No language target specified.' + lf);
        return;
      }
      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }
      h5p.copyTranslation(from, to, libraries, results);
    }
  },
  {
    name: 'pack-translation',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      const languageCode = libraries.splice(0, 1)[0];
      if (!languageCode) {
        process.stdout.write('No language specified.' + lf);
        return;
      }
      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }
      const options = filterOptions(libraries, [/\.zip$/]);
      const file = (options[0] ? options[0] : 'translations.zip');
      h5p.packTranslation(languageCode, libraries, file, function (error: any, results: any[]) {
        if (error) {
          process.stderr.write(error + lf);
        }
        else {
          let num = 0;
          for (let i = 0; i < results.length; i++) {
            if (results[i]) {
              num += 1;
            }
          }
          process.stdout.write('Successfully packed ' + num + ' translations into ' + file + lf);
        }
      });
    }
  },
  {
    name: 'recursive-minor-bump',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      h5p.recursiveMinorBump(libraries, results);
    }
  },
  {
    name: 'list-deps',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      h5p.recursiveMinorBump(libraries, results, true);
    }
  },
  {
    name: 'find-inconsistencies',
    handler: function () {
      h5p.findDependencyInconsistencies();
    }
  },
  {
    name: 'check-translations',
    handler: async (...inputList: string[]) => {
      try {
        await checkTranslations(...inputList);
        process.exit(0);
      }
      catch (error) {
        process.exit(1);
      }
    }
  },
  {
    name: 'build',
    handler: buildLibraries
  },
  {
    name: 'update-translations',
    handler: function () {
      const libraries = Array.prototype.slice.call(arguments);
      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }
      h5p.updateTranslations(libraries, results);
    }
  },
  {
    name: 'validate',
    handler: async (...inputList: string[]) => {
      const result = await validate(...inputList);
      const notValid = result.some((item) => item.status !== 'ok');
      if (notValid) {
        process.exit(1);
      }
      else {
        process.exit(0);
      }
    }
  },
  {
    name: 'bump',
    handler: bump
  }
];

function listCommands(): void {
  process.stdout.write('Available commands:' + lf);
  for (let i = 0; i < commands.length; i++) {
    const co = commands[i];
    if (co.name) {
      process.stdout.write('  ' + color.emphasize + co.name);
      if (co.syntax) {
        process.stdout.write(' ' + co.syntax);
      }
      process.stdout.write(color.default);
      if (co.shortDescription) {
        process.stdout.write('  ' + co.shortDescription);
      }
      process.stdout.write(lf);
    }
  }
}

function findCommand(name: string): any {
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].name === name) {
      return commands[i];
    }
  }
}

const cliExports: Record<string, any> = {};
for (const item of commands) {
  cliExports[item.name] = item.handler;
}

export default cliExports;
