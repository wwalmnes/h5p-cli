import { Command } from 'commander';
import { DependencyAnalysisService } from '../../services/dependency-analysis-service';

export function findInconsistenciesCommand(): Command {
  return new Command('find-inconsistencies')
    .description('Find version inconsistencies across libraries')
    .action(async () => {
      const svc = new DependencyAnalysisService();
      await svc.findInconsistencies();
    });
}
