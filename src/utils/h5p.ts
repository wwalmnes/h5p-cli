/**
 * Requirements
 */
import https from 'https';
import child from 'child_process';
import fs from 'fs';
import archiver from 'archiver';
import * as outputWriter from './utility/output';
import h5pIgnoreParser from './utility/h5p-ignore-parser';
import * as repository from './utility/repository';
import languageCodes from './utility/language-codes';

/**
 * No options specified.
 * @contant
 */
const PROCESS_NIL = 0;

/**
 * Do not check if repo is git repo.
 * @contant
 */
const PROCESS_SKIP_CHECK = 1;

/**
 * Used to run operations in serial when heavy I/O/network is involved.
 * @contant
 */
const PROCESS_SERIAL = 2;

/**
 * Local globals
 */
var apiVersion = 1;
var registry: any;
var collection: any; // A collection is used to avoid circular dependencies
var pullushers: any; // A collection ready for pushing or pulling
var env = process.env;
env.GIT_SSH = __dirname + '/bin/h5p-ssh';
// TODO: Try to start ssh-agent if env['SSH_AUTH_SOCK'] is missing?

// Allowed file pattern to test packed files again. If files do not pass they are ignored.
var allowedFilePattern = (process.env.H5P_ALLOWED_FILE_PATTERN !== undefined ? new RegExp(process.env.H5P_ALLOWED_FILE_PATTERN, process.env.H5P_ALLOWED_FILE_MODIFIERS) : /\.(json|png|jpg|jpeg|gif|bmp|tif|tiff|svg|eot|ttf|woff|woff2|otf|webm|mp4|ogg|mp3|txt|pdf|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|js|css)$/);

// Use env ignore pattern or default(ignores tmp files and hidden files).
var ignorePattern = (process.env.H5P_IGNORE_PATTERN !== undefined ? new RegExp(process.env.H5P_IGNORE_PATTERN, process.env.H5P_IGNORE_MODIFIERS) : /^\.|~$/gi);

// List of repositoreies to ignore
var ignoredRepos = (process.env.H5P_IGNORE_REPOS !== undefined ? process.env.H5P_IGNORE_REPOS.split(',') : []);
var semiIgnoredRepos = (process.env.H5P_SEMI_IGNORE_REPOS !== undefined ? process.env.H5P_SEMI_IGNORE_REPOS.split(',') : []);

// run callback based functions in parallel; returns cli.results compatible array;
const runAll = (runner: any, argsList: any, callback: any) => {
  const handle = (runner: any, args: any) => {
    return new Promise ((resolve, reject) => {
      runner.apply(null, [...args, ...[(status: any) => {
        resolve(status);
      }]]);
    });
  }
  const toDo = [];
  for (let args of argsList) {
    toDo.push(handle(runner, args));
  }
  Promise.allSettled(toDo)
    .then((output) => {
      const result = [];
      for (let item of output) {
        if (item.status == 'fulfilled') {
          result.push(item.value);
        }
        else {
          result.push(item.reason);
        }
      }
      callback(null, result);
    })
    .catch((error) => {
      callback(error);
    });
};

/**
 * Make ssh errors short and understandable.
 */
function sshError(error: any, url?: any) {
  if (error.indexOf('Host key verification failed.') !== -1) error = 'Host key verification failed.' + (url ? ' Try running ssh -T ' + url.split(':', 1)[0] : '') + '\n';
  if (error.indexOf('Permission denied') !== -1) error = 'Permission denied.\nMake sure ssh-agent is running.' + (url ? ' (ssh -T ' + url.split(':', 1)[0] + ' should not ask for password/passphrase)' : '') + '\n';
  return error;
}

/**
 * Skip ssh warnings.
 * (typically comes when a host has multiple IPs, like github.com)
 */
function skipWarnings(output: any) {
  if (output.substr(0, 8) === 'Warning:' || output.substr(0, 12) === 'Cloning into') output = '';
  return output;
}

/**
 * Run given callback with h5p registry as params.
 */
function getRegistry(next: any) {
  if (registry) return next(null, registry.libraries);

  https.get('https://h5p.org/registry.json', function (response) {
    if (response.statusCode !== 200) {
      return next('Server responded with HTTP ' + response.statusCode + '.');
    }

    var jsonBuffer = '';
    response.on('data', function (chunk) {
      jsonBuffer += chunk;
    });

    response.on('end', function () {
      try {
        registry = JSON.parse(jsonBuffer);
      }
      catch (error) {
        return next('Cannot parse registry information: ' + (error as any).message);
      }

      if (registry.apiVersion !== apiVersion) return next('API Version mismatch.\nMake sure this tool is up to date.');

      next(null, registry.libraries);
    });
  }).on('error', function (error) {
    return next('Cannot connect to server: ' + error.message);
  });
}

/**
 * Recursive function that adds the given library + its dependencies to the collection.
 */
function getLibrary(libraryName: any, next: any) {
  if (libraryName === '') return next();
  getRegistry(function (error: any, libraries: any) {
    if (error) return next(error);
    if (collection[libraryName]) return next(); // Already have this.

    var library = libraries[libraryName];
    if (!library) return next('No such library.');

    collection[libraryName] = library;

    if (library.dependencies) {
      // Find dependencies
      var errors = '';
      var loaded = 0;

      var dependency: any;
      for (var i = 0; i < library.dependencies.length; i++) {
        dependency = library.dependencies[i];
        getLibrary(dependency, function (error: any) {
          if (error) errors += '\n' + dependency + ': ' + error;
          loaded++;

          if (loaded === library.dependencies.length) {
            next(errors === '' ? null : errors);
          }
        });
      }
    }
    else {
      next();
    }
  });
}

function sshToHttps(url: any){
  return url.replace("git@github.com:", "https://github.com/");
}

/**
 * Clone repo at given url into given dir.
 */
function cloneRepository(dir: any, url: any, fetchWithHttps = false, next: any) {
  if(fetchWithHttps) {
    url = sshToHttps(url);
  }
  outputWriter.printError("cloning "+url);
  
  var proc = child.spawn('git', ['clone', url, dir], {env: env});
  proc.on('error', function (error) {
    next(error);
  });

  var output = '';
  proc.stderr.on('data', function (data) {
    output += skipWarnings(data.toString());
  });
  proc.stderr.on('end', function () {
    if (output.indexOf('already exists') !== -1) return next(-1);
    next(sshError(output, url));
  });
}

/**
 * Check if dir is a repo.
 */
function checkRepository(dir: any, next: any) {
  fs.stat(dir + '/.git/config', function (error, stats) {
    if (error) return next(null);
    next(dir);
  });
}

/**
 * Find all repos in the current working dir.
 * @deprecated Use h5p.findDirectories instead
 */
function findRepositories(next: any, skipCheck?: any) {
  fs.readdir('.', function (error, files) {
    if (error) return next(error);

    if (skipCheck) {
      next(null, files);
      return;
    }

    var repos: any[] = [];
    var processed = 0;
    for (var i = 0; i < files.length; i++) {
      checkRepository(files[i], function (repo: any) {
        if (repo) {
          repos.push(repo);
        }

        processed++;
        if (processed === files.length) {
          next(null, repos);
        }
      });
    }
  });
}

/**
 * Stage and commit all on the given repo.
 */
function commitRepository(dir: any, message: any, next: any) {
  var result: any = {
    name: dir
  };

  var procOpts = {cwd: process.cwd() + '/' + dir, env: env};

  var proc = child.spawn('git', ['add', '--all'], procOpts);

  proc.on('error', function (error) {
    result.error = error;
    next(result);
  });

  proc.on('exit', function (code) {
    if (code !== 0) {
      result.error = 'Exit code ' + code;
      return next(result);
    }

    // Everything staged. Commit!
    var proc = child.spawn('git', ['commit', '-m', message], procOpts);

    proc.on('error', function (error) {
      result.error = error;
      next(result);
    });

    var buffer = '';
    proc.stdout.on('data', function (data) {
      buffer += data.toString();
    });

    proc.stdout.on('end', function () {
      var lines = buffer.split('\n');
      lines.pop(); // Empty

      var line = lines.shift()!.replace(/\[|\]/g, '').split(' ', 3);
      if (line[0] !== '#') {
        result.branch = line[0];
        result.commit = line[1];
        result.changes = lines;
      }

      next(result);
    });

  });
}

/**
 * Pull the current branch for the given repo.
 */
function pullRepository(dir: any) {
  const proc = child.spawn('git', ['pull'], {
    cwd: process.cwd() + '/' + dir,
    env: env
  });

  const repo: any = {
    name: dir
  };

  let output = '';

  proc.stderr.on('data', data => {
    repo.error = true;
    output += data.toString();
  });

  proc.stdout.on('data', data => {
    output += data.toString();
  });

  return new Promise(resolve => {
    proc.on('close', () => {

      // Do not consider pulling from remote as an error
      if (output.includes('From ')) {
        repo.error = false;
      }

      repo.msg = output;
      resolve(repo);
    });
  });
}

/**
 * Get the diff for the given repo.
 */
function diffRepository(dir: any, next: any) {
  var proc = child.spawn('git', ['diff'], {cwd: process.cwd() + '/' + dir});
  proc.on('error', function (error) {
    next(error);
  });

  var buffer = '';
  proc.stdout.on('data', function (data) {
    buffer += data.toString();
  });
  proc.stdout.on('end', function () {
    // Update file paths.
    buffer = buffer.replace(/\n(---|\+\+\+) (a|b)\/(.+)/g, '\n$1 $2/' + dir + '/$3').replace(/(^|\n)(diff --git a\/)(.+ b\/)(.+)/g, '$1$2' + dir + '/$3' + dir + '/$4');

    next(null, buffer);
  });
}

/**
 * Cycle through given repos and run process callback.
 * @deprecated Use processRepositories instead
 *
 * @private
 * @param {Array} repos
 * @param {Number} [options]
 * @param {Function} process
 * @param {Function} next
 */
function processRepos(repos: any, options: any, process: any, next?: any) {
  if (typeof options !== 'number') {
    // Options not specified, shift args
    next = process;
    process = options;
    options = PROCESS_NIL;
  }

  findRepositories(function (error: any, validRepos: any) {
    if (error) return next(error);

    var all = !repos.length || (repos.length === 1 && repos[0] === '*');
    if (all) {
      // Do all repos
      repos = validRepos;
    }

    var each = function (id: any, value: any, done: any) {
      if (ignoredRepos.indexOf(value) !== -1 || !(options & PROCESS_SKIP_CHECK) && semiIgnoredRepos.indexOf(value) !== -1) {
        // Ignore repo
        done({
          name: value,
          skipped: true,
          msg: 'ignored'
        });
        return;
      }

      if (all) {
        // No need to check if repo is valid, just process
        process(value, done);
        return;
      }

      // Find valid repo and process
      for (var j = 0; j < validRepos.length; j++) {
        if (validRepos[j] === value) {
          process(value, done);
          return;
        }
      }

      // Specified repo wasn't found
      done({
        name: value,
        skipped: true,
        msg: 'no git repository found'
      });
    };

    if (options & PROCESS_SERIAL) {
      serial(repos, each, next);
    }
    else {
      parallel(repos, each, next);
    }

  }, options & PROCESS_SKIP_CHECK);
}

/**
 * Return processed repositories with their resolved status.
 *
 * @param repos
 * @param dirs
 * @param options
 */
function processRepositories(repos: any, dirs: any, options: any) {
  if (typeof options !== 'number') {
    options = PROCESS_NIL;
  }

  const all = !repos.length || (repos.length === 1 && repos[0] === '*');
  if (all) {
    // Do all repos
    repos = dirs;
  }

  return getReposStatus(repos, dirs, all, options);
}

/**
 * Helps run procecss task on all items in parallel.
 * TODO: In the future support objects as well?
 *
 * @private
 * @param {Array} arr item container
 * @param {Function} process task
 * @param {Function} finished callback
 */
function parallel(arr: any, process: any, finished: any) {
  var results: any[] = [];

  /**
   * Callback for when processing is done
   *
   * @private
   * @param {Object} status
   */
  var done = function (status: any) {
    results.push(status);
    if (results.length === arr.length) {
      finished(null, results);
    }
  };

  for (var i = 0; i < arr.length; i++) {
    process(i, arr[i], done);
  }
}

/**
 * Resolves with valid libraries
 *
 * @param repositories
 * @param validRepositories
 * @param all
 * @param options
 * @return {Promise.<*>}
 */
function getReposStatus(repositories: any, validRepositories: any, all: any, options: any) {
  return Promise.all(
    repositories
      .filter((repo: any) => all || isValidRepo(repo, validRepositories, options))
      .map((repo: any) => getLibraryStatus(repo))
  );
}

/**
 * Helps process each property on the given object asynchronously in serial order.
 *
 * @private
 * @param {(Array|Object)} obj list
 * @param {Function} process
 * @param {Function} finished
 */
function serial(obj: any, process: any, finished: any) {
  var id, isArray = obj instanceof Array;

  // Keep track of each property that belongs to this object.
  if (!isArray) {
    var ids: any[] = [];
    for (id in obj) {
      if (obj.hasOwnProperty(id)) {
        ids.push(id);
      }
    }
  }

  // Keep track of the current property
  var i = -1;

  /**
   * Process the next property.
   * @private
   */
  var next = function () {
    id = isArray ? i : ids[i];
    process(id, obj[id], check);
  };

  /**
   * Check if we're done or have an error.
   *
   * @private
   * @param {String} err
   */
  var check = function (err?: any) {
    // We need to use a real async function in order for the stack to clear.
    setTimeout(function () {
      i++;
      if (i === (isArray ? obj.length : ids.length) || (err !== undefined && err !== null)) {
        finished(err);
      }
      else {
        next();
      }
    }, 0);
  };

  // Start
  check();
}

/**
 * Gets status of a single repository
 *
 * @param repo
 * @return {Promise}
 */
let getLibraryStatus = function (repo: any) {
  const status: any = {
    name: repo
  };

  return new Promise((resolve, reject) => {
    fs.readFile(repo + '/library.json', (err, data) => {
      if (err) {
        status.skipped = true;
        status.msg = err;
        outputWriter.printResults(status);
        reject(status);
        return;
      }

      const library = JSON.parse(data.toString());
      const target = library.machineName + '-' + library.majorVersion + '.' + library.minorVersion;
      status.msg = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      outputWriter.printResults(status);
      resolve({
        path: repo,
        target
      });
    });
  });
};

/**
 * Verifies that the repo is valid
 *
 * @param value
 * @param validRepos
 * @param options
 * @return {boolean} True if valid repo
 */
let isValidRepo = function (value: any, validRepos: any, options: any) {
  if (ignoredRepos.indexOf(value) !== -1 || !(options & PROCESS_SKIP_CHECK) && semiIgnoredRepos.indexOf(value) !== -1) {
    // Ignore repo
    outputWriter.printResults({
      name: value,
      skipped: true,
      msg: 'ignored'
    });
    return false;
  }

  // Find valid repo and process
  if (validRepos.some((repo: any) => repo === value)) {
    return true;
  }

  // Specified repo wasn't found
  outputWriter.printResults({
    name: value,
    skipped: true,
    msg: 'no git repository found'
  });
  return false;
};

/**
 * Start a git process and capture the output.
 *
 * @private
 * @param {String} dir
 * @param {Array} options
 * @param {Function} next
 */
function spawnGit(dir: any, options: any, next: any) {
  var proc = child.spawn('git', options, {cwd: process.cwd() + '/' + dir, env: env});

  var outBuff = '';
  proc.stdout.on('data', function (data) {
    outBuff += data.toString();
  });

  var errBuff = '';
  proc.stderr.on('data', function (data) {
    errBuff += data.toString();
  });

  proc.on('error', function (error) {
    next(error, '');
  });
  proc.on('close', function () {
    next(sshError(errBuff), outBuff);
  });
}

/**
 * Start a git process and capture the output.
 *
 * @private
 * @param {string} file
 * @param {function} next
 */
function spawn(type: any, options: any, dir: any, next: any) {
  var envVars = {cwd: process.cwd(), env: env, detached: true};
  if (dir) {
    envVars.cwd += '/' + dir;
  }
  var proc = child.spawn(type, options, envVars);

  var outBuff = '';
  proc.stdout.on('data', function (data) {
    outBuff += data.toString();
  });

  var errBuff = '';
  proc.stderr.on('data', function (data) {
    errBuff += data.toString();
  });

  proc.on('error', function (error) {
    next(error, undefined);
  });
  proc.on('close', function () {
    next(errBuff ? errBuff : undefined, outBuff ? outBuff : undefined);
  });

  return proc.stdin;
}

/**
 * Start a iconv process and capture the output.
 *
 * @private
 * @param {String} dir
 * @param {Array} options
 * @param {Function} next
 */
function toUTF8(file: any, next: any) {
  // Detect charset
  spawn('file', ['-i', file], null, function (err: any, result: any) {
    if (err) {
      return next(err);
    }
    var input = result.match(/charset=([^\n\r ]+)/);
    if (!input || !input[1]) {
      return next('unable to detect charset');
    }

    var iconv = spawn('iconv', ['-f', input[1], '-t', 'utf-8', file], null, function (err: any, utf8: any) {
      next(err, utf8);
    });
  });
}

/**
 * Change branch on the given repo.
 *
 * @private
 * @param {(Array|String)} options Branch or set of options.
 * @param {String} dir
 * @param {Function} next
 */
function checkoutRepository(options: any, dir: any, next: any) {
  var args = ['checkout'];
  if (options instanceof Array) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }
  else {
    args.push(options);
  }

  spawnGit(dir, args, function (error: any, output: any) {
    var status: any = {
      name: dir
    };

    var isNotWhitelisted = error.substr(0, 7) !== 'Already'
      && error.substr(0, 8) !== 'Switched' && error.substr(0,8) !== 'Previous';
    if (error !== '' && isNotWhitelisted) {
      if (error.substr(7, 8) === 'pathspec' || error.substr(0, 21) === 'fatal: A branch named') {
        // Branch not found
        status.skipped = true;
      }
      else {
        // Failed
        status.failed = true;
        status.msg = error.substr(7, error.length - 8);
      }
    }
    else {
      var lines = output.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var matches = lines[i].match(/^Your branch is (.+)$/);
        if (matches && matches[1].substr(0, 10) !== 'up-to-date') {
          status.msg = matches[1];
        }
      }
    }

    next(status);
  });
}

/**
 * Change branch on the given repo.
 *
 * @private
 * @param {Array} [options] Set of options
 * @param {String} dir
 * @param {Function} next
 */
function pushRepository(options: any, dir: any, next: any) {
  var args = ['push'];
  if (options !== undefined) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }

  spawnGit(dir, args, function (error: any, output: any) {
    var status: any = {
      name: dir
    };

    var res = error.substr(0, 2);
    if (res === 'Ev') {
      status.skipped = true;
    }
    else if (res === 'To') {
      output = error.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
      if (output.substr(0, 1) === '!') {
        status.failed = true;
        status.msg = output + '\n';
      }
      else if (output.substr(0, 2) === '* ') {
        status.msg = output.substring(2, output.length);
      }
    }
    else {
      status.failed = true;
      status.msg = error;
    }

    next(status);
  });
}

/**
 * Merge in the selected branch.
 *
 * @private
 * @param {String} branch
 * @param {String} dir
 * @param {Function} next
 */
function mergeRepository(branch: any, dir: any, next: any) {
  spawnGit(dir, ['merge', branch, '--no-ff'], function (error: any, output: any) {
    var status: any = {
      name: dir
    };

    if (error !== '') {
      if (error.indexOf('not something we can merge') !== -1) {
        // Branch not found
        status.skipped = true;
      }
      else if (error.indexOf('you have unmerged files') !== -1) {
        status.failed = true;
        status.msg = 'unmerged files';
      }
      else {
        // Failed
        status.failed = true;
        status.msg = error;
      }
    }
    else {
      var lines = output.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].substr(0, 8) === 'CONFLICT') {
          status.failed = true;
          status.msg = 'conflict';
          break;
        }
      }
    }

    next(status);
  });
}

/**
 * Loads data from given JSON file in repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {string} file
 *    JSON file with extension, e.g. '/library.json'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function readJson(repo: any, file: any, next: any) {
  try {
    next(null, JSON.parse(fs.readFileSync(repo + file).toString()));
  }
  catch (err: any) {
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      err = 'not a library';
    }
    next(err);
  }
}

/**
 * Loads library data for given repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function libraryData(repo: any, next: any) {
  readJson(repo, '/library.json', next);
}

/**
 * Loads semantics data for given repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function readSemantics(repo: any, next: any) {
  readJson(repo, '/semantics.json', next);
}

/**
 * Recursive archiving of the given path.
 */
function archiveDir(archive: any, path: any, alias?: any) {
  if (alias === undefined) alias = path;

  if (path.match(ignorePattern) !== null) {
    // Skip archiving dir
    return;
  }

  var files = fs.readdirSync(path);
  if (files.indexOf('.h5pignore') >= 0) {
    const accepts = h5pIgnoreParser(path);
    files = files.filter(accepts);
  }
  for (var i = 0; i < files.length; i++) {
    var filename = files[i];
    var file = path + '/' + filename;
    var target = alias + '/' + filename;

    // Skip hidden files and tmp files.
    if (filename.match(ignorePattern) !== null) {
      continue;
    }

    if (fs.lstatSync(file).isDirectory()) {
      archiveDir(archive, file, target);
    }
    else if (allowedFilePattern.test(filename)) {
      archive.append(fs.createReadStream(file), {name: target});
    }
  }
}

/**
 * Remove untranslatable properties from semantics (recursive)
 *
 * @param {String} field A field
 * @param {String} name Name of field
 * @param {String} parent Parent object
 * @param {String} parentName Property name of parent object
 */
function removeUntranslatables(field: any, name?: any, parent?: any, parentName?: any) {
  if(field instanceof Array) {
    const fieldParent = JSON.parse(JSON.stringify(field));
    for (var i = field.length; i >= 0; i--) {
      field[i] = removeUntranslatables(field[i], undefined, fieldParent, name);
      if (field[i] === undefined) {
        field.splice(i, 1);
      }
    }
    if (field.length === 0) {
      field = undefined;
    }
  }
  else if (typeof field === 'object') {
    const fieldParent = JSON.parse(JSON.stringify(field));
    for(var property in field) {
      field[property] = removeUntranslatables(field[property], property, fieldParent, name);
      if(field[property] === undefined) {
        delete field[property];
      }
    }
    
    // remove empty objects if not under 'fields' parentName
    if (field !== null && parentName !== 'fields' && Object.keys(field).length === 0) {
      field = undefined;
    }
    
    // Remove unnecessary nested 'field' structures with only empty objects
    const hasOnlyFields = field?.fields && Array.isArray(field.fields);
    if (hasOnlyFields && field.fields.every((subField: any) => {
      return typeof subField === 'object' && Object.keys(subField).length === 0;
    })) {
      // Remove just the empty 'fields', let the rest be
      if (Object.keys(field).length !== 1) {
        delete field.fields;
      }
      else {
        field = undefined;
      }
    }

    // Remove 'default' attribute if 'options' is present
    if (field?.options && field.default) {
      delete field.default;
    }
  }
  else if (name === undefined || itemUntranslatable(name, field, parent)) {
    field = undefined;
  }
  if (field === null) {
    field = undefined;
  }
  return field;
}

/**
 * Check if an item is untranslatable.
 * @param {string} property An object's property.
 * @param {object} value value of the property.
 * @return {boolean} true, if item is untranslatable.
 */
function itemUntranslatable(property: any, value: any, parent: any) {
  switch (property) {
    case 'label':
    case 'entity':
    case 'explanation':
    case 'example':
      return false;
    
    case 'description':
    case 'placeholder':
      return value.trim().length === 0;
    
    case 'default':
      if (typeof value !== 'string') {
        return true;
      }
      // Remove empty strings. One example is Dictation, which has a space for 
      // a word separator setting.
      if (value.trim().length === 0) {
        return true;
      }
      // If this is a number, don't include it
      if (!isNaN(Number(value))) {
        return true;
      }
      if (!value.replaceAll(new RegExp(/<\/?[a-z][^>]*>/ig), '')) { // empty html tags
        return true;
      }
      
      if (
        // 3 digit hex color codes
        new RegExp(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).test(value) === true ||
        // 4 digit hex color codes incl. alpha channel
        new RegExp(/^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/).test(value) === true ||
        // rgb(a) color codes, sloppy check
        new RegExp(/^rgb(a)?(\()?[\d\s,\.\/%]+(\))?$/).test(value) === true ||
        // hsl(a) color codes, sloppy check
        new RegExp(/^hsl(a)?(\()?[\d\s,\.\/%]+(\))?$/).test(value) === true ||
        // hwb color codes, sloppy check
        new RegExp(/^hsv?(\()?[\d\s,\.\/%]+(\))?$/).test(value) === true ||
        // hwb color codes, sloppy check
        new RegExp(/^hwb\([\w\d\s,\.\/%]+\)$/).test(value) === true
        // Ignoring lab, oklab, lch, oklch, color() and other color spaces
      ) { // color codes
        return true;
      }
      if (languageCodes.indexOf(value) !== -1) { // language codes
        return true;
      }
      break
    default:
      return true;
  }
}

/**
 * Read file contents.
 *
 * @param {string} path
 * @param {function} next
 */
function readFile(path: any, next: any) {
  fs.readFile(path, function (err, data) {
    if (err) {
      next(err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1 ? 'not a library' : err);
    }
    else {
      next(null, data);
    }
  });
}

/**
 * Check if the library head is detached.
 *
 * @param {string} repo
 * @param {function} next
 */
function isHeadDetached(repo: any, next: any) {
  readFile(repo + '/.git/HEAD', function (err: any, head: any) {
    if (err) return next(err); // Pass errors

    next(null, head.toString().substr(0, 3) !== 'ref');
  });
}

/**
 * Status = skipped
 *
 * @param {string} name
 * @param {string} [msg]
 * @param {function} next
 */
function skipped(name: any, msg: any, next: any) {
  next({
    name: name,
    skipped: true,
    msg: msg
  });
}

/**
 * Status = ok
 *
 * @param {string} name
 * @param {string|Object} [msg]
 * @param {function} next
 */
function ok(name: any, msg: any, next: any) {
  next({
    name: name,
    msg: msg
  });
}

/**
 * Status = failed
 *
 * @param {string} name
 * @param {string|Object} [msg]
 * @param {function} next
 */
function failed(name: any, msg: any, next: any) {
  next({
    name: name,
    failed: true,
    msg: msg
  });
}

/**
 * Bump instances of machine name found in semantics to minor version.
 *
 * @param {Array} semantics Semantics as array of semantic fields
 * @param {number} minorVersion
 *    Minor version that target will be upgraded to
 * @param {string} machineName Machine name of target library as a string
 *
 * @returns {Array}
 *  Returns found semantics field with dependency to machineName
 */
function semanticBump(semantics: any, minorVersion: any, machineName: any) {
  var foundFields: any[] = [];

  if (!semantics) {
    return foundFields;
  }

  // Handle semantic types
  semantics.forEach(function (field: any) {

    // Handle library selector with options
    if (field.type === 'library') {

      // Go through options
      field.options.forEach(function (option: any, index: any) {
        if (option.split(' ')[0] === machineName) {
          var majorVersion = option.split(' ')[1].split('.')[0];

          // Update value
          field.options[index] = machineName + ' ' + majorVersion + '.' + minorVersion;
          foundFields.push(majorVersion);
        }
      });
    }
    else if (field.fields) {

      // Handle groups/similar semantics that has array sub-fields
      var foundChildren = semanticBump(field.fields, minorVersion, machineName);
      foundFields = foundFields.concat(foundChildren);
    }
    else if(field.field) {

      // Handle lists/similar semantics that has a single sub-field
      var foundChild = semanticBump([field.field], minorVersion, machineName);
      foundFields = foundFields.concat(foundChild);
    }
  });

  return foundFields;
}

/**
 * Checks if source repo has a dependency to target library
 *
 * @param {string} target Machine name of target library as string
 * @param {number} minorVersion Minor version of target
 * @param {function} next Function which handles dependency
 * @param {boolean} [skipWriting] Skip updating files
 */
function recursiveBump(target: any, minorVersion: any, next: any, skipWriting: any) {

  // Check through all repos
  processRepos(['*'], function (repo: any, done: any) {
    libraryData(repo, function (error: any, library: any) {
      if (error) {
        return skipped(repo, error, done);
      }


      var preloadedDependencies = library.preloadedDependencies || [];

      preloadedDependencies.forEach(function (dependency: any) {

        if (dependency.machineName === target) {
          dependency.minorVersion = minorVersion;
          process.stdout.write('Preloaded dependency ' +
              '\x1B[1m' + dependency.machineName + '\x1B[0m' +
              ' ' + (skipWriting ? 'found' : 'updated') + ' in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              dependency.majorVersion + '.' + minorVersion + '\u000A');
          if (!skipWriting) {
            fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
          }

          // Update minor version of library unless already done
          if (collection.indexOf(repo) < 0) {
            collection.push(repo);
            h5p.recursiveMinorBump([repo], next, skipWriting);
          }
        }
      });

      var editorDependencies = library.editorDependencies || [];
      editorDependencies.forEach(function (dep: any) {
        if (dep.machineName === target) {
          dep.minorVersion = minorVersion;
          process.stdout.write('Editor dependency ' +
              '\x1B[1m' + dep.machineName + '\x1B[0m' +
              ' updated in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              dep.majorVersion + '.' + minorVersion + '\u000A');
          if (!skipWriting) {
            fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
          }

          // Update minor version of library unless already done
          if (collection.indexOf(repo) < 0) {
            collection.push(repo);
            h5p.recursiveMinorBump([repo], next, skipWriting);
          }
        }
      });

    });

    readSemantics(repo, function (error: any, semantics: any) {
      var foundFields = semanticBump(semantics, minorVersion, target);
      if (foundFields.length) {
        for (var i = 0; i < foundFields.length; i++) {
          process.stdout.write('Semantics dependency ' +
              '\x1B[1m' + target + '\x1B[0m' +
              ' updated in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              foundFields[i] + '.' + minorVersion + '\u000A');
        }

        // Here we have to write to JSON semantics
        if (!skipWriting) {
          fs.writeFileSync(repo + '/semantics.json', JSON.stringify(semantics, null, 2));
        }

        // Update minor version of library unless already done
        if (collection.indexOf(repo) < 0) {
          collection.push(repo);
          h5p.recursiveMinorBump([repo], next, skipWriting);
        }
      }
    });
  }, next);
}

/**
 * Will find lastest version number offset by given versions and then run the
 * given process for each repo not in a detached HEAD state.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} process Callback for processing each repo.
 * @param {function} next Callback for when processing is done (displays results).
 */
function getVersions(versions: any, repos: any, process: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    isHeadDetached(repo, function (error: any, yes: any) {
      if (error) {
        return failed(repo, error, done);
      }
      if (yes) {
        return skipped(repo, 'detached HEAD', done);
      }

      // Find tagged versions
      spawnGit(repo, ['tag', '-l', '--sort=version:refname'], function (error: any, output: any) {
        if (error) {
          return failed(repo, error, done);
        }

        var toDiff;
        var tags = output.split('\n');
        var numValidVersions = 0;
        // Newest version is at the end
        for (var i = tags.length - 1; i >= 0; i--) {
          if (tags[i].match(/(\d+)\.(\d+)\.(\d+)/ig)) {
            numValidVersions += 1; // Found a valid version

            // Skip as many versions as specified
            if (numValidVersions === versions) {
              toDiff = tags[i];
              break;
            }
          }
        }
        if (toDiff) {
          process(repo, toDiff, false, done);
        }
        else {
          spawnGit(repo, ['rev-list', '--max-parents=0', 'HEAD'], function (error: any, output: any) {
            var firstCommit = output.split('\n')[0];
            process(repo, firstCommit, true, done);
          });
        }
      });
    });
  }, next, true);
}

function getVersionsAll(versions: any, repos: any, process: any, next: any) {
  const argsList = [];
  const runner = function (repo: any, done: any) {
    isHeadDetached(repo, function (error: any, yes: any) {
      if (error) {
        return failed(repo, error, done);
      }
      if (yes) {
        return skipped(repo, 'detached HEAD', done);
      }
      // Find tagged versions
      spawnGit(repo, ['tag', '-l', '--sort=version:refname'], function (error: any, output: any) {
        if (error) {
          return failed(repo, error, done);
        }
        var toDiff;
        var tags = output.split('\n');
        var numValidVersions = 0;
        // Newest version is at the end
        for (var i = tags.length - 1; i >= 0; i--) {
          if (tags[i].match(/(\d+)\.(\d+)\.(\d+)/ig)) {
            numValidVersions += 1; // Found a valid version
            // Skip as many versions as specified
            if (numValidVersions === versions) {
              toDiff = tags[i];
              break;
            }
          }
        }
        if (toDiff) {
          process(repo, toDiff, false, done);
        }
        else {
          spawnGit(repo, ['rev-list', '--max-parents=0', 'HEAD'], function (error: any, output: any) {
            var firstCommit = output.split('\n')[0];
            process(repo, firstCommit, true, done);
          });
        }
      });
    });
  }
  for (let repo of repos) {
    argsList.push([repo]);
  }
  runAll(runner, argsList, next);
};

/**
 * Export our api.
 */
const h5p: any = {};

/**
 * Return list of libraries.
 */
h5p.list = function (next: any) {
  getRegistry(function (error: any, libraries: any) {
    next(error, libraries);
  });
};

/**
 * Creates a new collection and fills it up with the given library and its dependencies.
 */
h5p.get = function (libraries: any, next: any) {
  collection = {}; // Start a new collection

  var loop = function (i: any) {
    getLibrary(libraries[i], function (error: any) {
      i += 1;
      if (i === libraries.length) return next(error);
      loop(i);
    });
  };
  loop(0);
};

/**
 * Clone the next library in the collection.
 */
h5p.clone = function (fetchWithHttps = false, next: any) {
  for (var lib in collection) {
    cloneRepository(lib, collection[lib].repository, fetchWithHttps, next);
    delete collection[lib];
    return lib;
  }
  return false;
};

/**
 * Find all repos in the current working dir.
 *
 * @param {boolean} [skipCheck]
 * @param {string} [path]
 * @return {Promise}
 */
h5p.findDirectories = function (skipCheck: any, path?: any) {
  return new Promise((resolve, reject) => {
    path = path || '.';
    fs.readdir(path, function (error, files) {
      if (error) {
        // outputWriter.printError(error.toString());
        reject(error);
        return;
      }

      if (skipCheck) {
        resolve(files);
        return;
      }

      var repos: any[] = [];
      var processed = 0;
      for (var i = 0; i < files.length; i++) {
        checkRepository(files[i], function (repo: any) {
          if (repo) {
            repos.push(repo);
          }

          processed++;
          if (processed === files.length) {
            if (repos.length === 0) {
              reject(new Error('input dirs are not git repos (you can use the \'-f\' flag to skip this check)'));
              return;
            }
            resolve(repos);
          }
        });
      }
    });
  });
};

/**
 * Commit all changes to all libraries.
 */
h5p.commit = function (message: any, next: any) {
  findRepositories(function (error: any, repos: any) {
    if (error) return next(error);

    var results: any[] = [];
    for (var i = 0; i < repos.length; i++) {
      commitRepository(repos[i], message, function (result: any) {
        results.push(result);
        if (results.length === repos.length) {
          next(null, results);
        }
      });
    }
  });
};

h5p.commitRepos = function (message: any, repos: any, next: any) {
  var results: any[] = [];
  for (var i = 0; i < repos.length; i++) {
    commitRepository(repos[i], message, function (result: any) {
      results.push(result);
      if (results.length === repos.length) {
        next(null, results);
      }
    });
  }
};

/**
 * Will prepare a collection of repos for pushing/pulling.
 */
h5p.update = function (repos: any, next: any) {
  pullushers = []; // Start a new collection

  processRepos(repos, function (repo: any, done: any) {
    pullushers.push(repo);
    done();
  }, next);
};

/**
 * Pull the next library in the collection.
 */
h5p.pull = function () {
  return Promise.all(
    pullushers.map((repo: any) => {
      return pullRepository(repo);
    })
  );
};

/**
 * Push the next library in the collection.
 */
h5p.push = function (options: any, next: any) {
  // TODO: Use pushRepository and progress
  var repo = pullushers.shift();
  if (!repo) {
    return false;
  }
  var args = ['push'];
  if (options !== undefined) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }
  spawnGit(repo, args, function (error: any, output: any) {
    var res = error.substr(0, 2);
    if (res === 'Ev') {
      return next(-1);
    }
    if (res === 'To') {
      output = error.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
      if (output.substr(0, 1) === '!') {
        return next(output + '\n');
      }
      if (output.substr(0, 2) === '* ') {
        output = output.substring(2, output.length);
      }
      return next(null, output);
    }

    next(error, output);
  });

  return repo;
};

/**
 * Push all libraries in the collection.
 */
h5p.pushAll = function (options: any) {
  console.log('pushing ', pullushers);
  var args = ['push'];
  if (options !== undefined) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }
  const pushRepo = (repo: any) => {
    return new Promise((resolve, reject) => {
      spawnGit(repo, args, function (error: any, output: any) {
        var res = error.substr(0, 2);
        if (res === 'Ev') {
          return reject(-1);
        }
        if (res === 'To') {
          output = error.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
          if (output.substr(0, 1) === '!') {
            return reject(output + '\n');
          }
          if (output.substr(0, 2) === '* ') {
            output = output.substring(2, output.length);
          }
          return resolve(output);
        }
        if (error) {
          reject(error);
        }
        else {
          resolve(output);
        }
      });
    });
  }
  const toDo = [];
  for (let repo of pullushers) {
    toDo.push(pushRepo(repo));
  }
  pullushers = [];
  return Promise.allSettled(toDo);
};

/**
 * Push the next library in the collection.
 */
h5p.checkout = function (branch: any, repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    checkoutRepository(branch, repo, done);
  }, next);
};

h5p.checkoutAll = function (branch: any, repos: any, next: any) {
  const argsList = [];
  for (let repo of repos) {
    argsList.push([branch, repo]);
  }
  runAll(checkoutRepository, argsList, next);
};

/**
 * Create and push a new branch upstream.
 *
 * @param {String} branch name
 * @param {Array} [repos] list
 * @param {Function} progress callback
 */
h5p.newBranch = function (branch: any, repos: any, progress: any) {
  // Keeps track of previous result
  var result: any;

  processRepos(repos, PROCESS_SERIAL, function (repo: any, done: any) {
    // Progress update
    progress(result, repo);

    // Checkout repo
    checkoutRepository(['-b', branch], repo, function (status: any) {
      if (status.failed || status.skipped) {
        // Failed or skipped
        result = status;

        // Go to next
        done();
        return;
      }

      // Push our new branch to origin
      pushRepository(['-u', 'origin', branch], repo, function (status: any) {
        result = status;
        if (!result.skipped && !result.failed) {
          delete result.msg;
        }
        done();
      });
    });
  }, function () {
    // Final progress update
    progress(result);
  });
};

/**
 * Delete branch both locally and upstream.
 *
 * @param {String} branch name
 * @param {Array} [repos] list
 * @param {Function} progress callback
 */
h5p.rmBranch = function (branch: any, repos: any, progress: any) {
  // Keeps track of previous result
  var result: any;

  processRepos(repos, PROCESS_SERIAL, function (repo: any, done: any) {
    // Progress update
    progress(result, repo);

    // Delete locally
    spawnGit(repo, ['branch', '-D', branch], function (error: any, output: any) {
      result = {
        name: repo
      } as any;

      if (error) {
        if (error.indexOf('not found.') !== -1) {
          result.skipped = true;
        }
        else {
          result.failed = true;
          result.msg = error;
        }
        done();
        return;
      }

      // Go remote
      pushRepository(['origin', ':' + branch], repo, function (status: any) {
        result = status;
        done();
      });
    });

  }, function () {
    // Final progress update
    progress(result);
  });
};

/**
 * Get diffs for all repos.
 */
h5p.diff = function (next: any) {
  findRepositories(function (error: any, repos: any) {
    if (error) return next(error);
    var diffs = '', done = 0;
    for (var i = 0; i < repos.length; i++) {
      diffRepository(repos[i], function (error: any, diff: any) {
        if (error) return next(error);
        diffs += diff;
        if (done++ === repos.length - 1) next(null, diffs);
      });
    }
  });
};

/**
 * Merge in given branch for given repos.
 *
 * @public
 * @namespace h5p
 */
h5p.merge = function (branch: any, repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    mergeRepository(branch, repo, done);
  }, next);
};

h5p.mergeAll = function (branch: any, repos: any, next: any) {
  const argsList = [];
  for (let repo of repos) {
    argsList.push([branch, repo]);
  }
  runAll(mergeRepository, argsList, next);
};

/**
 * Create language file for a given repo
 *
 * @public
 * @namespace h5p
 */
h5p.createLanguageFile = function (repo: any, languageCode: any, next: any) {
  readSemantics(repo, function (error: any, semantics: any) {
    var languageFile = repo + '/language/' + languageCode + '.json';
    fs.writeFileSync(languageFile, JSON.stringify({
      semantics: removeUntranslatables(semantics)
    }, null, 2));
    next(languageFile + ' created');
  });
};

/**
 * Create default language object for a given repo
 *
 * @public
 * @namespace h5p
 */
h5p.createDefaultLanguage = function (libraryDir: any) {
  const file = `${libraryDir}/semantics.json`;
  return fs.existsSync(file) ? removeUntranslatables(JSON.parse(fs.readFileSync(file).toString())) : {};
};

/**
 * Pack repos
 *
 * @param {string[]} repos Repos that will be packed
 * @param {string} file Filename of packed repos
 * @return {Promise} Resolves with status of packed repos
 */
h5p.pack = function (repos: any, file: any) {
  const output = fs.createWriteStream(file);
  const archive = archiver('zip');
  archive.on('error', function (err: any) {
    outputWriter.printError(String(err));
  });
  archive.pipe(output);
  return h5p.findDirectories(PROCESS_SKIP_CHECK)
    .then((directories: any) => processRepositories(repos, directories, PROCESS_SKIP_CHECK))
    .then((processedRepositories: any) => {
      processedRepositories.forEach(function (repo: any) {
        archiveDir(archive, repo.path, repo.target);
      });
      archive.finalize();
    });
};

/**
 * Recursively bump minor version of repos
 *
 * @param {Array} repos Repositories minor version will be bumped for
 * @param {function} next
 *    Handles the found repos where minor versions has been bumped.
 *    Accepts two arguments (error, repos)
 * @param {boolean} [skipWriting]
 */
h5p.recursiveMinorBump = function (repos: any, next: any, skipWriting: any) {
  collection = collection || [];

  // Increase minor version of library
  processRepos(repos, function (repo: any, done: any) {
    libraryData(repo, function (error: any, library: any) {
      if (error) {
        return skipped(repo, error, done);
      }

      var upVersion = function () {
        library.minorVersion++;
        library.patchVersion = 0;
        if (!skipWriting) {
          fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
        }
        ok(repo, library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion, done);
      };

      upVersion();

      // Increase minor version of all libraries that has dependency to this library
      recursiveBump(library.machineName, library.minorVersion, next, skipWriting);
    });
  }, next);
};

/**
 * Find all library dependencies in semantics
 * 
 * @param {Array} semantics 
 * @param {Function} addLibrary 
 */
const findLibrariesInSemantics = function (semantics: any, addLibrary: any) {
  semantics.forEach(function (field: any) {

    // Handle library selector with options
    if (field.type === 'library') {

      // Go through options
      field.options.forEach(function (option: any, index: any) {

        const machineName = option.split(' ')[0];
        const majorVersion = option.split(' ')[1].split('.')[0];
        const minorVersion = option.split(' ')[1].split('.')[1];

        addLibrary({
          machineName: machineName,
          majorVersion: majorVersion,
          minorVersion: minorVersion
        });

      });
    }
    else if (field.fields) {
      findLibrariesInSemantics(field.fields, addLibrary);
    }
    else if (field.field) {
      findLibrariesInSemantics([field.field], addLibrary);
    }
  });
};

/**
 * Find inconsistencies in library dependencies. This will detect 
 * a dependency tree containing two different versions of the same library
 */
h5p.findDependencyInconsistencies = function () {

  const libraries: Record<string, any> = {};

  const addDependency = (library: any, dependency: any) => {
    const libraryId = library.machineName + '-' + library.majorVersion + '.' + library.minorVersion;

    if (!libraries.hasOwnProperty(libraryId)) {
      libraries[libraryId] = {
        library: {
          name: library.machineName,
          version: library.majorVersion + '.' + library.minorVersion
        },
        deps: []
      };
    }

    const dependencyId = dependency.machineName + '-' + dependency.majorVersion + '.' + dependency.minorVersion;
    if (!libraries.hasOwnProperty(dependencyId)) {
      libraries[dependencyId] = {
        library: {
          name: dependency.machineName,
          version: dependency.majorVersion + '.' + dependency.minorVersion
        },
        deps: []
      };
    }

    libraries[libraryId].deps.push(libraries[dependencyId]);
  };

  /**
   * Flatten the dependency tree so that we'll get a list per library
   * 
   * @param {string} libraryId 
   * @param {Array} dependencies 
   * @param {Object} flat 
   */
  const flattenDependencyTree = (libraryId: any, dependencies: any, flat: any) => {

    for (let i = 0; i < dependencies.length; i++) {
      const dependency = dependencies[i];
      
      if (!flat[libraryId].hasOwnProperty(dependency.library.name)) {
        flat[libraryId][dependency.library.name] = [];
      }

      // If already added, just skip this
      if (flat[libraryId][dependency.library.name].indexOf(dependency.library.version) !== -1) {
        continue;
      }

      flat[libraryId][dependency.library.name].push(dependency.library.version);

      if (dependency.deps) {
        flattenDependencyTree(libraryId, dependency.deps, flat);
      }
    }
  };

  /**
   * Find duplicate dependencies to different versions
   */
  const findDuplicatesWithDifferentVersions = () => {
    const flat: Record<string, any> = {};

    for (let libraryId in libraries) {
      flat[libraryId] = {};
      flattenDependencyTree(libraryId, libraries[libraryId].deps, flat);
    }

    for (let libraryId in flat) {
      const library = flat[libraryId];
      for (let dependency in library) {
        if (library[dependency].length > 1) {
          const versions = library[dependency].join(', ');
          console.log(`Inconsistency detected for ${libraryId} -> ${dependency} (versions: ${versions})`);
        }
      }
    };
  }

  // Check through all repos
  processRepos(['*'], function (repo: any, done: any) {
    var libraryRef: any;
    libraryData(repo, function (error: any, library: any) {
      if (error) {
        return skipped(repo, error, done);
      }

      libraryRef = library;
      var preloadedDependencies = library.preloadedDependencies || [];

      preloadedDependencies.forEach(function (dependency: any) {
        addDependency(library, dependency);
      });

      var editorDependencies = library.editorDependencies || [];
      editorDependencies.forEach(function (dep: any) {
        addDependency(library, dep);
      });
    });

    readSemantics(repo, function (error: any, semantics: any) {
      if (semantics) {
        findLibrariesInSemantics(semantics, (dependency: any) => addDependency(libraryRef, dependency));
      }
      done();
    });
  }, () => {
    findDuplicatesWithDifferentVersions();
  });
}

/**
 * Increase patch version on the given libraries, but only if there are changes
 * since their last tag. Use force to override and update anyway.
 *
 * @param {boolean} force
 * @param {Array} repos
 * @param {function} next
 */
h5p.increasePatchVersion = function (force: any, repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    libraryData(repo, function (error: any, library: any) {
      if (error) {
        return skipped(repo, error, done);
      }

      isHeadDetached(repo, function (err: any, yes: any) {
        if (err) {
          return skipped(repo, err, done);
        }
        if (yes) {
          return skipped(repo, 'detached HEAD', done);
        }

        var upVersion = function () {
          library.patchVersion++;
          fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
          ok(repo, library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion, done);
        };

        if (force) {
          return upVersion();
        }

        // Diff current version agains head to check for changes
        spawnGit(repo, ['diff', library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion + '..HEAD'], function (error: any, output: any) {
          if (error) {
            if (error.indexOf('fatal: ambiguous argument') !== -1) {
              // Increase patch version if last version wasn't tagged
              output = true;
            }
            else {
              return failed(repo, error, done);
            }
          }
          if (!output) {
            // No diff, no changes
            return skipped(repo, undefined, done);
          }

          upVersion();
        });
      });
    });
  }, next, true);
};

/**
 * Add tag with library version number.
 *
 * @public
 * @param {Array} repos
 * @param {Function} next
 */
h5p.tagVersion = function (repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    libraryData(repo, function (error: any, library: any) {
      var status: any = {
        name: repo
      };

      if (error) {
        status.failed = true;
        status.msg = error;
        done(status);
        return;
      }

      var version = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      spawnGit(repo, ['tag', version], function (error: any, output: any) {
        if (error !== '') {
          if (error.indexOf('already exists') !== -1) {
            status.skipped = true;
          }
          else {
            status.failed = true;
            status.msg = error;
          }
        }
        else {
          status.msg = version;
        }

        done(status);
      });

    });
  }, next);
};

h5p.tagVersionAll = function (repos: any, next: any) {
  const runner = (repo: any, done: any) => {
    libraryData(repo, function (error: any, library: any) {
      var status: any = {
        name: repo
      };
      if (error) {
        status.failed = true;
        status.msg = error;
        done(status);
        return;
      }
      var version = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      spawnGit(repo, ['tag', version], function (error: any, output: any) {
        if (error !== '') {
          if (error.indexOf('already exists') !== -1) {
            status.skipped = true;
          }
          else {
            status.failed = true;
            status.msg = error;
          }
        }
        else {
          status.msg = version;
        }
        done(status);
      });
    });
  }
  const argsList = [];
  for (let repo of repos) {
    argsList.push([repo]);
  }
  runAll(runner, argsList, next);
};

/**
 * Add tag
 *
 * @public
 * @param {String} tagName
 * @param {Array} repos
 * @param {Function} next
 */
h5p.tag = function (tagName: any, repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    var status: any = {
      name: repo
    };

    spawnGit(repo, ['tag', tagName], function (error: any, output: any) {
      if (error !== '') {
        if (error.indexOf('already exists') !== -1) {
          status.skipped = true;
        }
        else {
          status.failed = true;
          status.msg = error;
        }
      }
      else {
        status.msg = tagName;
      }

      done(status);
    });
  }, next);
};

h5p.tagAll = function (tagName: any, repos: any, next: any) {
  const argsList = [];
  const runner = function (tagName: any, repo: any, done: any) {
    const status: any = {
      name: repo
    };
    spawnGit(repo, ['tag', tagName], function (error: any, output: any) {
      if (error !== '') {
        if (error.indexOf('already exists') !== -1) {
          status.skipped = true;
        }
        else {
          status.failed = true;
          status.msg = error;
        }
      }
      else {
        status.msg = tagName;
      }
      done(status);
    });
  }
  for (let repo of repos) {
    argsList.push([tagName, repo]);
  }
  runAll(runner, argsList, next);
};

/**
 * Will find file changes for the given number of last versions.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} next Callback for when processing is done (displays results).
 */
h5p.changesSince = function (versions: any, repos: any, next: any) {
  getVersions(versions, repos, function (repo: any, version: any, initialCommit: any, done: any) {
    spawnGit(repo, ['diff', '--stat', version + '..HEAD'], function (error: any, output: any) {
      if (error) {
        return failed(repo, error, done);
      }

      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

h5p.changesSinceAll = function (versions: any, repos: any, next: any) {
  getVersionsAll(versions, repos, function (repo: any, version: any, initialCommit: any, done: any) {
    spawnGit(repo, ['diff', '--stat', version + '..HEAD'], function (error: any, output: any) {
      if (error) {
        return failed(repo, error, done);
      }
      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

/**
 * Finds file changes since release, and lists them, useful for determining patch
 * and minor version changes.
 */
h5p.changesSinceRelease = function (repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    spawnGit(repo, ['diff', '--stat', 'master..release'], function (error: any, output: any) {
      if (error) {
        return failed(repo, {error: error, output: output}, done);
      }

      ok(repo, {changes: output}, done);
    });
  }, next);
};

h5p.changesSinceReleaseAll = function (repos: any, next: any) {
  const runner = (repo: any, done: any) => {
    spawnGit(repo, ['diff', '--stat', 'master..release'], function (error: any, output: any) {
      if (error) {
        return failed(repo, {error: error, output: output}, done);
      }
      ok(repo, {changes: output}, done);
    });
  }
  const argsList = [];
  for (let repo of repos) {
    argsList.push([repo]);
  }
  runAll(runner, argsList, next);
};

h5p.compareTagsRelease = function (repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    libraryData(repo, function (err: any, library: any) {
      if (err) {
        return skipped(repo, err, done);
      }

      var libraryVersion = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;

      spawnGit(repo, ['describe', '--abbrev=0', '--tags'], function (error: any, output: any) {
        if (error) {
          return failed(repo, {error: error, output: output}, done);
        }

        var trimmedOutput = output.replace('\n', '').trim();

        if (libraryVersion !== trimmedOutput) {
          ok(repo, {changes: 'changed from ' + trimmedOutput + ' to ' + libraryVersion}, done);
        }
        else {
          skipped(repo, libraryVersion + '- no changes', done);
        }
      });
    })


  }, next);
}

h5p.compareTagsReleaseAll = function (repos: any, next: any) {
  const argsList = [];
  const runner = function (repo: any, done: any) {
    libraryData(repo, function (err: any, library: any) {
      if (err) {
        return skipped(repo, err, done);
      }
      var libraryVersion = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      spawnGit(repo, ['describe', '--abbrev=0', '--tags'], function (error: any, output: any) {
        if (error) {
          return failed(repo, {error: error, output: output}, done);
        }
        var trimmedOutput = output.replace('\n', '').trim();
        if (libraryVersion !== trimmedOutput) {
          ok(repo, {changes: 'changed from ' + trimmedOutput + ' to ' + libraryVersion}, done);
        }
        else {
          skipped(repo, libraryVersion + '- no changes', done);
        }
      });
    });
  }
  for (let repo of repos) {
    argsList.push([repo]);
  }
  runAll(runner, argsList, next);
};

/**
 * Will find commits for the given number of last versions.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} next Callback for when processing is done (displays results).
 */
h5p.commitsSince = function (versions: any, repos: any, next: any) {
  getVersions(versions, repos, function (repo: any, version: any, initialCommit: any, done: any) {
    spawnGit(repo, ['log', '--oneline', version + '..HEAD'], function (error: any, output: any) {
      if (error) {
        return failed(repo, error, done);
      }
      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

h5p.commitsSinceAll = function (versions: any, repos: any, next: any) {
  getVersionsAll(versions, repos, function (repo: any, version: any, initialCommit: any, done: any) {
    spawnGit(repo, ['log', '--oneline', version + '..HEAD'], function (error: any, output: any) {
      if (error) {
        return failed(repo, error, done);
      }
      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

h5p.importLanguageFiles = function (dir: any, next: any) {
  // Check if dir exists.
  fs.readdir(dir, function (error, repos) {
    if (error) return next(error);

    // Get libraries with dir sub folders
    processRepos(repos, function (repo: any, done: any) {
      var status: any = {
        name: repo
      };

      // Look for language files
      var langDir = dir + '/' + repo + '/language';
      fs.readdir(langDir, function (error, languageFiles) {
        if (error) {
          if (error.errno === 34) {
            status.skipped = true;
            status.msg = 'no language folder found';
          }
          else {
            status.failed = true;
            error = error;
          }

          return done(status);
        }

        // Process language files
        parallel(languageFiles, function (index: any, file: any, nextFile: any) {
          var lang = file.match(/^([a-z]{2}).json$/);
          if (!lang) {
            // Not correct file format, skip
            return nextFile(null);
          }

          var fileStatus: any = {
            lang: lang[1].toUpperCase()
          };

          // Copy file
          toUTF8(langDir + '/' + file, function (err: any, json: any) {
            if (err) {
              fileStatus.failed = true;
              fileStatus.msg = err;
              return nextFile(fileStatus);
            }

            try {
              var translation = JSON.parse(json);
              fs.writeFileSync(repo + '/language/' + file, JSON.stringify(translation, null, 2), {flag: 'w'});
            }
            catch (error) {
              // Failed to add / invalid format
              fileStatus.failed = true;
              fileStatus.msg = error;
            }
            // TODO: Should we count translations / missing ?

            nextFile(fileStatus);
          });
        }, function (err: any, results: any) {

          // Process results
          var added = [];
          var failed = [];

          for (var i = 0; i < results.length; i++) {
            if (!results[i]) {
              continue;
            }

            if (results[i].failed) {
              failed.push(results[i].lang);
            }
            else {
              added.push(results[i].lang);
            }
          }

          if (added.length) {
            status.msg = 'added ' + added.join(', ');
          }
          if (failed.length) {
            status.failed = true;
            if (!status.msg) {
              status.msg = '';
            }
            status.msg = (status.msg ? status.msg + ', ' : '') + 'failed to add ' + failed.join(', ');
          }
          done(status);
        });
      });
    }, next);
  });
};

/**
 * Will populate language files with the original texts.
 *
 * @param {string} languageCode
 * @param {string[]} repos
 * @param {function} next
 * @param {boolean} [populate] Populates language files with the original text
 */
h5p.addOriginalTexts = function (languageCode: any, repos: any, next: any, populate: any) {
  processRepos(repos, function (repo: any, done: any) {
    // Keep track of the status for the current repo
    var status: any = {
      name: repo
    };

    // Define the files we need
    var fileNames = {
      semantics: repo + '/semantics.json',
      translation: repo + '/language/' + languageCode + '.json'
    };

    h5p.readJSONFiles(fileNames, function (files: any) {
      // Error handling
      if (files.semantics.error) {
        status.msg = files.semantics.error;
      }
      else if (files.translation.error && files.translation.error !== 'not a library') {
        status.msg = files.translation.error;
      }
      if (status.msg) {
        status.failed = true;
        return done(status);
      }

      // Update translation
      var translation = files.translation.content || {};
      translation.semantics = updateTranslationFields(files.semantics.content, translation.semantics, function (field: any, attr: any, source: any, target: any) {
        if (attr === 'label' || attr === 'description' || attr === 'entity' || attr === 'placeholder' || (attr === 'default' && field.type === 'text')) {
          target['english' + attr[0].toUpperCase() + attr.substr(1)] = field[attr];
          var fillText = populate ? field[attr] : 'TODO';
          target[attr] = (source !== undefined && source[attr] !== undefined ? source[attr] : fillText);
          return true;
        }
      });

      // Write changes
      writeJSONFile(fileNames.translation, translation, function (err: any) {
        if (err) {
          status.failed = true;
          status.msg = err;
        }
        done(status);
      });
    });
  }, next);
};

/**
 * Will use on translation to create another.
 *
 * @param {string} from Language Code
 * @param {string} to Language Code
 * @param {string[]} repos
 * @param {function} next
 */
h5p.copyTranslation = function (from: any, to: any, repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    // Keep track of the status for the current repo
    var status: any = {
      name: repo
    };

    // The file we need
    var fileNames = {
      source: repo + '/language/' + from + '.json'
    };
    h5p.readJSONFiles(fileNames, function (files: any) {
      // Handle errors reading file
      if (files.source.error) {
        status.msg = files.source.error;
        status.failed = true;
        return done(status);
      }

      // Get last commit for source
      spawnGit(repo, ['log', '-n 1', '--format=%h %at ', 'language/' + from + '.json'], function (error: any, output: any) {
        if (error) {
          status.msg = error;
          status.failed = true;
          return done(status);
        }

        // Add last commit id and date to translation
        var target: any = {};
        if (output) {
          output = output.split(' ');
          target.commit = output[0];
          target.date = output[1];
        }

        // Create target
        target.semantics = updateTranslationFields(files.source.content.semantics, undefined, function (field: any, attr: any, source: any, target: any) {
          if (attr.substr(0, 7) === 'english') {
            // Keep original values
            target[attr] = field[attr];
            return true;
          }
          if (attr === 'label' || attr === 'description' || attr === 'entity' || (attr === 'default' && field.type === 'text')) {
            target[attr] = 'TODO';
            return true;
          }
        });

        // Write changes
        writeJSONFile(repo + '/language/' + to + '.json', target, function (err: any) {
          if (err) {
            status.failed = true;
            status.msg = err;
          }
          done(status);
        });
      });
    });
  }, next);
};

/**
 * Will use on translation to create another.
 *
 * @param {string} from Language Code
 * @param {string} to Language Code
 * @param {string[]} repos
 * @param {string} file
 * @param {function} next
 */
h5p.packTranslation = function (lang: any, repos: any, file: any, next: any) {
  createPack(file, repos, next, function (archive: any, repo: any, done: any) {
    var file = repo + '/language/' + lang + '.json';
    readFile(file, function (error: any, content: any) {
      var added = false;
      if (!error && content) {
        archive.append(content, {name: file});
        added = true;
      }
      done(added);
    });
  });
};

/**
 * Makes it easier to create a package based on a list of repos
 *
 * @private
 * @param {string} file
 * @param {string[]} repos
 * @param {function} next
 * @param {function} process
 */
var createPack = function (file: any, repos: any, next: any, process: any) {
  var output = fs.createWriteStream(file);
  var archive = archiver('zip');
  var error: any, results: any;
  output.on('close', function () {
    next(error, results);
  });
  archive.on('error', function (err) {
    next(err);
  });
  archive.pipe(output);
  processRepos(repos, PROCESS_SKIP_CHECK, function (repo: any, done: any) {
    process(archive, repo, done);
  }, function (err: any, res: any) {
    error = err;
    results = res;
    archive.finalize();
  });
};

/**
 * Will read multiple JSON files simultaneously.
 *
 * @private
 * @param {object} fileNames
 * @param {function} next
 */
h5p.readJSONFiles = function (fileNames: any, next: any) {
  // Must use array, object not supported
  var filesToRead = [];
  for (var name in fileNames) {
    filesToRead.push(fileNames[name]);
  }

  // Read files in parallel
  parallel(filesToRead, function (index: any, file: any, fileRead: any) {
    readFile(file, function (error: any, content: any) {
      // File has been read, try to parse JSON
      if (!error) {
        try {
          content = JSON.parse(content);
        }
        catch (err) {
          error = err;
        }
      }
      // Return a status object
      fileRead({
        file: file,
        error: error,
        content: content
      });
    });
  }, function (error: any, fileStatus: any) {
    // All files have been read. Make it easy to map up content.
    var fileResults: Record<string, any> = {};
    for (var i = 0; i < fileStatus.length; i++) {
      var file = fileStatus[i];

      // Find key
      var fileKey: any;
      for (fileKey in fileNames) {
        if (fileNames[fileKey] === file.file) {
          break;
        }
      }
      fileResults[fileKey] = file;
    }
    next(fileResults);
  });
};

/**
 * Will write the given content to a single JSON file.
 *
 * @private
 * @param {string} file
 * @param {*} content
 * @param {function} next
 */
var writeJSONFile = function (file: any, content: any, next: any) {
  var json;
  try {
    json = JSON.stringify(content, null, 2) + '\n';
  }
  catch (error) {
    return next(error);
  }

  fs.writeFile(file, json, function (err) {
    next(err);
  });
};

/**
 * @private
 * @param {Array} semantics
 * @param {Array} [translation]
 * @param {function} [handler]
 * @param {boolean} [cleanup] Trigger removal of state for all fields
 * @returns {Array}
 */
var updateTranslationFields = function (semantics: any, translation?: any, handler?: any, cleanup?: any) {
  var updated = false;
  if (translation === undefined) {
    translation = [];
  }
  var translationOffset = 0;
  for (var i = 0; i < semantics.length; i++) {
    var field = semantics[i];
    var translationIndex = i + translationOffset;

    if (field.state === 'removed') {
      // Remove field from translation
      translation.splice(translationIndex, 1);
      updated = true;
      if (cleanup) {
        semantics.splice(i, 1);
        i--;
      }
      else {
        translationOffset--;
      }
      continue;
    }

    var fieldHasChanged = (field.state === 'new' || field.state === 'updated');
    var fieldTranslation = updateTranslationField(field, (fieldHasChanged ? undefined : translation[translationIndex]), handler, cleanup);
    if (field.state === 'new') {
      // Add new field
      translation.splice(translationIndex, 0, fieldTranslation);
    }
    else {
      // Update existing translation
      translation[translationIndex] = fieldTranslation;
    }
    if (cleanup) {
      delete field.state;
    }

    if (translation[translationIndex] !== undefined) {
      updated = true;
    }
    else {
      translation[translationIndex] = {};
    }
  }
  return updated ? translation : undefined;
};

/**
 * @private
 * @param {object} field
 * @param {object} [oldTranslation]
 * @param {function} [handler]
 * @param {boolean} [cleanup] Trigger removal of state for all fields
 * @returns {object}
 */
var updateTranslationField = function (field: any, oldTranslation: any, handler: any, cleanup?: any) {
  var updatedTranslation: any = {};
  var updated = false;
  for (var attr in field) {
    if (attr === 'field') {
      // Process single sub-field
      updatedTranslation.field = updateTranslationField(field.field, oldTranslation !== undefined ? oldTranslation.field : undefined, handler, cleanup);
      if (updatedTranslation.field !== undefined) {
        updated = true;
      }
    }
    else if (attr === 'fields' || attr === 'widgets' || attr === 'options') {
      // Process multiple sub-fields
      updatedTranslation[attr] = updateTranslationFields(field[attr], oldTranslation !== undefined ? oldTranslation[attr] : undefined, handler, cleanup);
      if (updatedTranslation[attr] !== undefined) {
        updated = true;
      }
    }
    else {
      var status = handler(field, attr, oldTranslation, updatedTranslation);
      if (!updated && status) {
        updated = true;
      }
    }
  }

  return updated ? updatedTranslation : undefined;
};

/**
 * Will scan the language folder and update each json file according to
 * semantics.json. Set the special field property "state" to one of:
 * new, updated, removed
 *
 * @param {string[]} repos
 * @param {function} next
 */
h5p.updateTranslations = function (repos: any, next: any) {
  processRepos(repos, function (repo: any, done: any) {
    // Keep track of the status for the current repo
    var status: any = {
      name: repo
    };

    // Define the files we need
    var fileNames: Record<string, any> = {
      semantics: repo + '/semantics.json'
    };

    // Read all JSON files from language dir
    var numLanguages = 0;
    var languageFiles = fs.readdirSync(repo + '/language');
    for (var i = 0; i < languageFiles.length; i++) {
      if (languageFiles[i].substr(-5,5) === '.json') {
        fileNames[languageFiles[i]] = repo + '/language/' + languageFiles[i];
        numLanguages++;
      }
    }

    h5p.readJSONFiles(fileNames, function (files: any) {
      // Error handling, we need semantics to continue
      if (files.semantics.error || !files.semantics.content) {
        status.msg = files.semantics.error;
        status.failed = true;
        return done(status);
      }

      // Go through all translations
      var numLanguagesProcessed = 0;
      for (var file in files) {
        if (file === 'semantics') {
          continue; // Skip
        }

        numLanguagesProcessed++;
        var languageFile = files[file];
        if (languageFile.error || !languageFile.content || !languageFile.content.semantics) {
          // TODO: Handle failed translation? Let the user know?
        }
        else {
          // Update translation
          var updatedTranslation = updateTranslationFields(files.semantics.content, languageFile.content.semantics, function (field: any, attr: any, source: any, target: any) {
            if (attr === 'important' || attr === 'label' || attr === 'description' || attr === 'entity' || attr === 'placeholder' || (attr === 'default' && field.type === 'text')) {
              target[attr] = (source !== undefined && source[attr] !== undefined ? source[attr] : field[attr]);
              return true;
            }
          }, numLanguagesProcessed === numLanguages);

          // Save translation
          writeJSONFile(fileNames[file], {semantics: updatedTranslation}, function (err: any) {
            if (err) {
              // TODO ?
            }

            if (numLanguagesProcessed === numLanguages) {
              // Save semantics
              writeJSONFile(fileNames.semantics, files.semantics.content, function (err: any) {
                if (err) {
                  // TODO ?
                }
                done(status);
              });
            }
          });
        }
      }
    });
  }, next);
};

// TODO: Add pre-commit hook?
//var preCommit = '#!/bin/sh\
//\
//h5p=$(which h5p)\
//if [ ! -f "$h5p" ]; then\
//  echo "Missing h5p command. Patch version not increased."\
//else\
//  lib=${PWD##*/}\
//  cd .. && "$h5p" increase-patch-version "$lib"\
//  cd "$lib" && git add .\
//fi'

export default h5p;
