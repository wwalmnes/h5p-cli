import Input from '../utility/input';
import * as output from '../utility/output';
import h5p from '../h5p';
import { statusRepository } from '../utility/repository';

const getRepositoriesStatus = function (repositories: string[], libraries: string[]): Promise<any[]> {
  return Promise.all(
    repositories
      .filter(repo => libraries.length > 0 ? libraries.indexOf(repo) >= 0 : true)
      .map(repo => statusRepository(repo))
  );
};

const outputRepositoriesStatus = function (repositories: any[], force: boolean): void {
  repositories
    .filter(repo => repo.error || repo.changes || force)
    .forEach(repo => output.printStatus(repo));
};

const status = function (...args: string[]) {
  const input = new Input(args);
  const force = input.hasFlag('-f');

  input.init()
    .then(() => {
      const libraries = input.getLibraries();

      h5p.findDirectories()
        .then((repositories: string[]) => getRepositoriesStatus(repositories, libraries))
        .then((repositories: any[]) => outputRepositoriesStatus(repositories, force))
        .catch((err: any) => output.printError);
    });
};

export default status;
