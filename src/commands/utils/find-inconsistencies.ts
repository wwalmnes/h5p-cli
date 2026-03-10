import { Command } from 'commander';

export function findInconsistenciesCommand(): Command {
  return new Command('find-inconsistencies')
    .description('Find version inconsistencies across libraries')
    .action(() => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      h5p.findDependencyInconsistencies();
    });
}
