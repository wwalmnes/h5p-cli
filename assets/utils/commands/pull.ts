import h5p from '../h5p';
import * as output from '../utility/output';
import Input from '../utility/input';

const pull = function (...inputList: string[]) {
  const input = new Input(inputList);
  return input.init()
    .then(() => {
      const libraries = input.getLibraries();
      h5p.update(libraries, function (error: any) {
        if (error) {
          return process.stdout.write(error);
        }
        doPull(libraries);
      });
    });
};

function doPull(libraries: string[]) {
  const repos = libraries.length === 1 ? 'repository' : 'repositories';
  const repoAmount = libraries.length ? libraries.length : 'all';
  const pullAnimation = new (output.Spinner as any)(`Pulling ${repoAmount} ${repos}`);
  h5p.pull().then((res: any) => {
    pullAnimation.succeeded('Finished pulling repositories');
    output.printPulled(res);
  });
}

export default pull;
