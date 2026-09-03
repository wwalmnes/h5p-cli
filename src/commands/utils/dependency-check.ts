import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { DependencyService } from '../../services/dependency-service.ts';
import type { Plan } from '../../lib/dependencies/plan.ts';
import {
  chain,
  cycleLines,
  editLines,
  planHead,
  planRows,
  summary,
  upToDateLines,
} from '../../lib/dependencies/report.ts';
import { formatVersion } from '../../lib/dependencies/version.ts';
import { ui } from '../../lib/ui.ts';

const argsSchema = z.object({
  libraries: z.array(z.string().min(1)).min(1),
  librariesDir: z.string().min(1),
  apply: z.boolean(),
});

function reportPlan(plan: Plan): void {
  for (const seed of plan.seeds) {
    ui.info(`${seed.machineName} ${formatVersion(seed.from)} -> ${formatVersion(seed.to)}`);
  }
  ui.info(`scanned ${plan.scanned} librar${plan.scanned === 1 ? 'y' : 'ies'} in ${plan.librariesDir}`);
  ui.info(summary(plan));

  ui.table(planRows(plan), { head: planHead(plan) });

  // The detail behind each row: why it is in the list, and what will change.
  for (const node of plan.order) {
    ui.debug(node.machineName);
    if (!node.seed) ui.debug(`via  ${chain(plan, node).join(' -> ')}`);
    for (const line of editLines(node)) ui.debug(line);
  }

  ui.list(cycleLines(plan), {
    title: 'Reference cycles — bump and update each group in one commit:',
  });

  for (const line of upToDateLines(plan)) ui.debug(line);
  for (const warning of plan.warnings) ui.warn(warning);
}

export function dependencyCheckCommand(service?: DependencyService): Command {
  return new Command('dependency-check')
    .description('Report which libraries need a minor bump when one or more libraries are bumped')
    .argument(
      '<libraries...>',
      'Libraries being bumped, e.g. H5P.Accordion, h5p-accordion or H5P.Accordion@1.0..1.2'
    )
    .option('--libraries <path>', 'Folder of library checkouts to analyse', process.env.H5P_LIBRARIES ?? '.')
    .option('--apply', 'Write the bumps and reference updates to disk', false)
    .action(async (libraries: string[], options) => {
      const svc = service ?? new DependencyService();

      try {
        const args = argsSchema.parse({
          libraries,
          librariesDir: options.libraries,
          apply: Boolean(options.apply),
        });

        const plan = svc.plan(args.librariesDir, args.libraries);
        reportPlan(plan);

        if (!args.apply) {
          ui.info('report only — re-run with --apply to write these changes');
          return;
        }

        const result = svc.apply(plan);

        for (const failure of result.failures) {
          ui.error(`could not apply ${failure.relFile}: ${failure.detail} — ${failure.reason}`);
        }

        ui.info(`${result.filesWritten.length} file(s) written`);
        ui.list(
          result.filesWritten.map((file) => path.relative(plan.librariesDir, file)),
          { title: 'Written' }
        );

        if (result.failures.length > 0) process.exitCode = 1;
      } catch (error) {
        ui.fail(error);
      }
    });
}
