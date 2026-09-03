import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const gitRefExists = (ref: string, cwd: string): boolean => {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${ref} || git show-ref --verify --quiet refs/remotes/${ref}`, {
      stdio: 'ignore',
      cwd,
    });
    return true;
  } catch {
    return false;
  }
};

export function branchesCommand(): Command {
  return new Command('branches')
    .alias('@branches')
    .description('Clone library branches into @branch folders')
    .argument('<library>', 'Library folder inside the libraries folder')
    .argument('<branches...>', 'Branch names to clone')
    .action((library: string, branches: string[]) => {
      try {
        const libDir = path.join(config.folders.libraries, library);
        if (!fs.existsSync(libDir)) {
          throw new Error(`library "${library}" not found in "${config.folders.libraries}"`);
        }
        const run = (command: string): string => execSync(command, { cwd: libDir }).toString();

        console.log(run('git checkout .'));
        run('rm -rdf @*');
        const initialBranch = run('git rev-parse --abbrev-ref HEAD');
        const validBranches: string[] = [];
        for (const branch of branches) {
          const target = `@${branch.replace('/', '_')}`;
          const tmpTarget = `/tmp/h5p-cli-${target}`;

          let checkoutRef = branch;

          if (!gitRefExists(branch, libDir)) {
            if (!branch.includes('/') && gitRefExists(`origin/${branch}`, libDir)) {
              checkoutRef = `origin/${branch}`;
            } else {
              console.log(`\x1b[33m > branch "${branch}" does not exist locally or remotely \x1b[0m`);
              continue;
            }
          }

          run(`git checkout ${checkoutRef}`);
          fs.rmSync(tmpTarget, { recursive: true, force: true });
          run(`cp -r . ${tmpTarget}`);
          validBranches.push(branch);
        }
        run(`git checkout ${initialBranch}`);
        const libraryJsonFile = path.join(libDir, 'library.json');
        const libraryJson = JSON.parse(fs.readFileSync(libraryJsonFile, 'utf-8'));
        for (const branch of validBranches) {
          const target = `@${branch.replace('/', '_')}`;
          const tmpTarget = `/tmp/h5p-cli-${target}`;
          run(`cp -r ${tmpTarget} ${target}`);
          fs.rmSync(tmpTarget, { recursive: true, force: true });
          const targetLibraryJson = JSON.parse(fs.readFileSync(path.join(libDir, target, 'library.json'), 'utf-8'));

          if (Array.isArray(targetLibraryJson.preloadedJs) && Array.isArray(libraryJson.preloadedJs)) {
            for (const item of targetLibraryJson.preloadedJs) {
              if (!item?.path) continue;
              libraryJson.preloadedJs.push({ ...item, path: `${target}/${item.path}` });
            }
          }

          if (Array.isArray(targetLibraryJson.preloadedCss) && Array.isArray(libraryJson.preloadedCss)) {
            for (const item of targetLibraryJson.preloadedCss) {
              if (!item?.path) continue;
              libraryJson.preloadedCss.push({ ...item, path: `${target}/${item.path}` });
            }
          }

          const packageFile = path.join(libDir, target, 'package.json');
          if (!fs.existsSync(packageFile)) {
            continue;
          }
          const info = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
          if (!info?.scripts?.build) {
            continue;
          }
          const pathToNodeModules = path.resolve(libDir, target, 'node_modules');
          if (fs.existsSync(pathToNodeModules)) {
            fs.rmSync(pathToNodeModules, { recursive: true, force: true });
          }
          console.log(`>>> npm install --ignore-scripts ${target}`);
          console.log(execSync('npm install --ignore-scripts', { cwd: path.join(libDir, target) }).toString());
          console.log(`>>> npm run build ${target}`);
          console.log(execSync('npm run build', { cwd: path.join(libDir, target) }).toString());
        }
        fs.writeFileSync(libraryJsonFile, JSON.stringify(libraryJson, null, 2));
      } catch (error) {
        ui.fail(error);
      }
    });
}
