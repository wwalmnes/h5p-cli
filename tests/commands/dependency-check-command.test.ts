import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dependencyCheckCommand } from '../../src/commands/utils/dependency-check.ts';
import type { ApplyResult } from '../../src/lib/dependencies/apply.ts';
import type { Plan } from '../../src/lib/dependencies/plan.ts';
import { ui } from '../../src/lib/ui.ts';

/** Accordion 1.2 -> 1.3, stranding Column 1.22 -> 1.23. */
function samplePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    librariesDir: '/libs',
    scanned: 2,
    seeds: [
      { machineName: 'H5P.Accordion', from: { major: 1, minor: 2 }, to: { major: 1, minor: 3 } },
    ],
    order: [
      {
        machineName: 'H5P.Accordion',
        dirName: 'h5p-accordion',
        from: { major: 1, minor: 2 },
        to: { major: 1, minor: 3 },
        seed: true,
        causes: [],
        edits: [],
      },
      {
        machineName: 'H5P.Column',
        dirName: 'h5p-column',
        from: { major: 1, minor: 22 },
        to: { major: 1, minor: 23 },
        seed: false,
        causes: [
          {
            via: 'H5P.Accordion',
            viaTo: { major: 1, minor: 3 },
            kind: 'semantics',
            where: 'content',
          },
        ],
        edits: [
          {
            kind: 'semantics-option',
            file: '/libs/h5p-column/semantics.json',
            relFile: 'h5p-column/semantics.json',
            token: '"H5P.Accordion 1.2"',
            replacement: '"H5P.Accordion 1.3"',
            detail: 'H5P.Accordion 1.2 -> 1.3  (content)',
            lines: [7],
          },
        ],
      },
    ],
    cycles: [],
    upToDate: [],
    warnings: [],
    ...overrides,
  };
}

function stubService(plan: Plan = samplePlan(), applyResult: ApplyResult = { filesWritten: [], failures: [] }) {
  return {
    plan: vi.fn().mockReturnValue(plan),
    apply: vi.fn().mockReturnValue(applyResult),
  } as any;
}

describe('dependencyCheckCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ui.resetLevel();
    process.exitCode = undefined;
  });

  it('has correct name', () => {
    expect(dependencyCheckCommand(stubService()).name()).toBe('dependency-check');
  });

  it('passes the named libraries and folder to the service', async () => {
    const svc = stubService();
    await dependencyCheckCommand(svc).parseAsync([
      'node', 'h5p', 'H5P.Accordion', 'h5p-column', '--libraries', '/elsewhere',
    ]);

    expect(svc.plan).toHaveBeenCalledWith('/elsewhere', ['H5P.Accordion', 'h5p-column']);
  });

  it('puts the bump list on stdout, where it survives a pipe', async () => {
    await dependencyCheckCommand(stubService()).parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stdout).toContain('H5P.Accordion');
    expect(stdout).toContain('H5P.Column');
    expect(stdout).toContain('1.22');
    expect(stdout).toContain('references H5P.Accordion');
  });

  it('reports only, until --apply', async () => {
    const svc = stubService();
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(svc.apply).not.toHaveBeenCalled();
    expect(stderr).toContain('re-run with --apply');
  });

  it('writes the plan under --apply', async () => {
    const plan = samplePlan();
    const svc = stubService(plan, {
      filesWritten: ['/libs/h5p-column/semantics.json'],
      failures: [],
    });
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion', '--apply']);

    expect(svc.apply).toHaveBeenCalledWith(plan);
    expect(stderr).toContain('1 file(s) written');
    expect(stderr).not.toContain('re-run with --apply');
  });

  it('fails the run when an edit could not be applied', async () => {
    const svc = stubService(samplePlan(), {
      filesWritten: [],
      failures: [
        {
          relFile: 'h5p-column/semantics.json',
          detail: 'H5P.Accordion 1.2 -> 1.3',
          reason: '"H5P.Accordion 1.2" not found',
        },
      ],
    });
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion', '--apply']);

    expect(stderr).toContain('could not apply h5p-column/semantics.json');
    expect(process.exitCode).toBe(1);
  });

  it('sends warnings to stderr, not into the table', async () => {
    const svc = stubService(samplePlan({ warnings: ['H5P.Column-1.21 is an older copy'] }));
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('H5P.Column-1.21 is an older copy');
    expect(stdout).not.toContain('older copy');
  });

  it('keeps chains and per-file edits for --verbose', async () => {
    const svc = stubService();
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion']);
    expect(stderr).not.toContain('h5p-column/semantics.json');

    stderr = '';
    ui.setLevel('verbose');
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('via  H5P.Accordion -> H5P.Column');
    expect(stderr).toContain('h5p-column/semantics.json:7');
  });

  it('reports a failure to scan as an error', async () => {
    const svc = {
      plan: vi.fn().mockImplementation(() => {
        throw new Error('Libraries directory not found: /nope');
      }),
      apply: vi.fn(),
    } as any;
    await dependencyCheckCommand(svc).parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('> error: Libraries directory not found: /nope');
    expect(process.exitCode).toBe(1);
  });
});
