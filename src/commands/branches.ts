import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ui } from '../lib/ui.ts';

const gitRefExists = (ref: string): boolean => {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${ref} || git show-ref --verify --quiet refs/remotes/${ref} || git show-ref --verify --quiet refs/tags/${ref}`, {
      stdio: 'ignore',
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
    .argument('<branches...>', 'Branch names to clone')
    .option('-n, --name [string]', 'Optional name to use for folder instead of branch name. If several branches names will be <name>, <name>1 etc.')
    .action((branches: string[], options: {name?: string}) => {
      try {
        console.log(execSync('git checkout .').toString());
        execSync('rm -rdf @*');
        const initialBranch = execSync('git rev-parse --abbrev-ref HEAD').toString();
        const validBranches: string[] = [];
        for (const branch of branches) {
          let folderName: string = branch;
          if (options?.name) {
            folderName = `${options.name}${validBranches.length ? validBranches.length : ''}`
          }

          const target = `@${folderName.replace('/', '_')}`;
          const tmpTarget = `/tmp/h5p-cli-${target}`;

          let checkoutRef = branch;

          if (!gitRefExists(branch)) {
            if (!branch.includes('/') && gitRefExists(`origin/${branch}`)) {
              checkoutRef = `origin/${branch}`;
            } else {
              console.log(`\x1b[33m > branch "${branch}" does not exist locally or remotely \x1b[0m`);
              continue;
            }
          }

          execSync(`git checkout ${checkoutRef}`);
          fs.rmSync(tmpTarget, { recursive: true, force: true });
          execSync(`cp -r . ${tmpTarget}`);
          validBranches.push(branch);
        }
        execSync(`git checkout ${initialBranch}`);
        const libraryJson = JSON.parse(fs.readFileSync('library.json', 'utf-8'));
        for (let i = 0; i < validBranches.length; i++) {
          const branch = validBranches[i];
          let folderName: string = branch;
          if (options?.name) {
            folderName = `${options.name}${i ? i : ''}`
          }

          const target = `@${folderName.replace('/', '_')}`;
          const tmpTarget = `/tmp/h5p-cli-${target}`;
          execSync(`cp -r ${tmpTarget} ${target}`);
          fs.rmSync(tmpTarget, { recursive: true, force: true });
          const targetLibraryJson = JSON.parse(fs.readFileSync(`${target}/library.json`, 'utf-8'));

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

          const packageFile = `${target}/package.json`;
          if (!fs.existsSync(packageFile)) {
            continue;
          }
          const info = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
          if (!info?.scripts?.build) {
            continue;
          }
          const pathToNodeModules = path.resolve(process.cwd(), target, 'node_modules');
          if (fs.existsSync(pathToNodeModules)) {
            fs.rmSync(pathToNodeModules, { recursive: true, force: true });
          }
          console.log(`>>> npm install --ignore-scripts ${target}`);
          console.log(execSync('npm install --ignore-scripts', { cwd: target }).toString());
          console.log(`>>> npm run build ${target}`);
          console.log(execSync('npm run build', { cwd: target }).toString());
        }
        fs.writeFileSync('library.json', JSON.stringify(libraryJson, null, 2));
      } catch (error) {
        ui.error(error);
      }
    });
}
