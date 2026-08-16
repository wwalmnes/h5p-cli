import path from 'path';
import { applyPlan, type ApplyResult } from '../lib/dependencies/apply.ts';
import { buildPlan, type Plan } from '../lib/dependencies/plan.ts';
import { scanLibraries } from '../lib/dependencies/scan.ts';
import { parseSeedArg } from '../lib/dependencies/version.ts';

export class DependencyService {
  plan(librariesDir: string, seeds: string[]): Plan {
    const dir = path.resolve(librariesDir);
    return buildPlan(scanLibraries(dir), {
      seeds: seeds.map(parseSeedArg),
      librariesDir: dir,
    });
  }

  apply(plan: Plan): ApplyResult {
    return applyPlan(plan);
  }
}
