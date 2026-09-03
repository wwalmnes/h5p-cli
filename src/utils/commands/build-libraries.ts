import { reportResult } from '../../lib/repo-report.ts';
import { splitLibrariesAndLanguages } from '../../lib/resolve-libraries.ts';
import { findRepos } from '../../lib/process-repos.ts';
import path from 'path';
import fs from 'fs';
import child from 'child_process';

export type BuildOptions = {
  test?: boolean;
  install?: boolean;
};

const buildLibraries = async function (names: string[], options: BuildOptions = {}): Promise<void> {
  const { libraries } = splitLibrariesAndLanguages(names, await findRepos());
  const settings = {
    testLibraries: options.test ?? false,
    installLibraries: options.install ?? false
  };

  await Promise.all(libraries.map(library => processPackage(settings, library)));
};

function processPackage(options: any, library: string): Promise<void> {
  return hasPackage({ options, library: library.toString() })
    .then(installDependencies)
    .then(buildPackage)
    .then(testPackage)
    .then(({ library }: any) => {
      reportResult({ name: library, msg: 'Build complete' });
    })
    .catch((repo: any) => reportResult(repo));
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
