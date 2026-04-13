import Input from '../utility/input.ts';
import * as output from '../utility/output.ts';
import path from 'path';
import fs from 'fs';
import child from 'child_process';

const FLAGS = {
  ONLY_TEST: ['-t', '-test'],
  INSTALL: ['-i', '-install']
};

const buildLibraries = function (...inputList: string[]) {
  const input = new Input(inputList);
  const testLibraries = input.hasFlag(FLAGS.ONLY_TEST);
  const installLibraries = input.hasFlag(FLAGS.INSTALL);
  const options = {
    testLibraries,
    installLibraries
  };
  input.init().then(() => {
    const libraries = input.getLibraries();
    libraries.forEach(processPackage.bind(null, options));
  });
};

function processPackage(options: any, library: string): void {
  hasPackage({ options, library: library.toString() })
    .then(installDependencies)
    .then(buildPackage)
    .then(testPackage)
    .then(({ library }: any) => {
      output.printResults({ name: library, msg: 'Build complete' });
    })
    .catch((repo: any) => output.printResults(repo));
}

function hasPackage({ options, library }: any): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.access(path.resolve(process.cwd(), library, 'package.json'), err => {
      if (err) {
        reject({
          name: library,
          skipped: true
        });
      }
      resolve({ options, library });
    });
  });
}

function testPackage({ options, library }: any): Promise<any> {
  if (!options.testLibraries) {
    return Promise.resolve({ options, library });
  }

  let failed = false;
  const spawnProcess = child.spawn('npm', ['test'], {
    cwd: path.resolve(process.cwd(), library),
    shell: true
  });

  spawnProcess.stderr.on('data', () => {
    failed = true;
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({
        name: library,
        failed
      });
    });
  });
}

function buildPackage({ options, library }: any): Promise<any> {
  const spawnProcess = child.spawn('npm', ['run', 'build', '--if-present'], {
    cwd: path.resolve(process.cwd(), library),
    shell: false,
  });

  return new Promise((resolve, reject) => {
    let success = false;
    spawnProcess.stdout.on('data', () => {
      success = true;
    });

    spawnProcess.on('close', code => {
      if (code && code > 0) {
        reject({
          name: library,
          failed: true,
        });
      }

      if (!success) {
        reject({
          name: library,
          skipped: true,
        });
      }

      resolve({ options, library });
    });
  });
}

function installDependencies({ options, library }: any): Promise<any> {
  if (!options.installLibraries) {
    return Promise.resolve({ options, library });
  }

  const spawnProcess = child.spawn('npm', ['install', '--ignore-scripts'], {
    cwd: path.resolve(process.cwd(), library),
    shell: true
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({ options, library });
    });
  });
}

export default buildLibraries;
