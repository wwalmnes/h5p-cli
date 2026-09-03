import { Command } from 'commander';
import { z } from 'zod';
import { DependencyService } from '../../services/dependency-service.ts';
import type { InconsistencyReport } from '../../lib/dependencies/inconsistencies.ts';
import {
  conflictHead,
  conflictLines,
  conflictRows,
  inconsistencySummary,
} from '../../lib/dependencies/report.ts';
import { ui } from '../../lib/ui.ts';

const argsSchema = z.object({
  librariesDir: z.string().min(1),
  transitive: z.boolean(),
});

function reportInconsistencies(report: InconsistencyReport, transitive: boolean): void {
  ui.info(inconsistencySummary(report));

  // The table is the data a script consumes, so every conflicting pin goes in
  // it; the prose lines are chrome that summarise the same rows.
  const conflicts = [...report.direct, ...report.transitive];
  ui.table(conflictRows(conflicts), { head: conflictHead() });

  ui.list(conflictLines(report.direct), {
    title: 'Declared by the library itself:',
  });

  if (transitive) {
    ui.list(conflictLines(report.transitive), {
      title: 'Reachable through dependencies:',
    });
  }

  for (const warning of report.warnings) ui.warn(warning);
}

export function findInconsistenciesCommand(service?: DependencyService): Command {
  return new Command('find-inconsistencies')
    .description('Find libraries that pin the same dependency at two different versions')
    .option('--libraries <path>', 'Folder of library checkouts to analyse', process.env.H5P_LIBRARIES ?? '.')
    .option('--transitive', 'Also report conflicts reachable through dependencies', false)
    .action(async (options) => {
      const svc = service ?? new DependencyService();

      try {
        const args = argsSchema.parse({
          librariesDir: options.libraries,
          transitive: Boolean(options.transitive),
        });

        const report = svc.inconsistencies(args.librariesDir, args.transitive);
        reportInconsistencies(report, args.transitive);

        // A conflict is a finding, not a crash — but it should still fail a
        // scripted check, the same way `dependency-check` fails on a bad edit.
        if (report.direct.length + report.transitive.length > 0) process.exitCode = 1;
      } catch (error) {
        ui.fail(error);
      }
    });
}
