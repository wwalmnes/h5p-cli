import { Command } from 'commander';
import h5p from '../../../assets/utils/h5p';

export function findInconsistenciesCommand(): Command {
  return new Command('find-inconsistencies')
    .description('Find version inconsistencies across libraries')
    .action(() => {
      h5p.findDependencyInconsistencies();
    });
}
