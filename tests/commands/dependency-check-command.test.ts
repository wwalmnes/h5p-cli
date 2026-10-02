import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dependencyCheckCommand } from '../../src/commands/utils/dependency-check.ts';
import { applyPlan, type ApplyResult } from '../../src/lib/dependencies/apply.ts';
import { buildPlan, type Plan } from '../../src/lib/dependencies/plan.ts';
import { scanLibraries } from '../../src/lib/dependencies/scan.ts';
import { ui } from '../../src/lib/ui.ts';

vi.mock('../../src/lib/dependencies/scan.ts', () => ({ scanLibraries: vi.fn(() => []) }));
vi.mock('../../src/lib/dependencies/plan.ts', () => ({ buildPlan: vi.fn() }));
vi.mock('../../src/lib/dependencies/apply.ts', () => ({ applyPlan: vi.fn() }));

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

function stubPlan(plan: Plan = samplePlan(), applyResult: ApplyResult = { filesWritten: [], failures: [] }) {
  vi.mocked(buildPlan).mockReturnValue(plan);
  vi.mocked(applyPlan).mockReturnValue(applyResult);
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
    stubPlan();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ui.resetLevel();
    process.exitCode = undefined;
  });

  it('plans from the named libraries in the given folder', async () => {
    await dependencyCheckCommand().parseAsync([
      'node', 'h5p', 'H5P.Accordion', 'h5p-column', '--libraries', '/elsewhere',
    ]);

    expect(scanLibraries).toHaveBeenCalledWith(path.resolve('/elsewhere'));
    expect(vi.mocked(buildPlan).mock.calls[0][1]).toMatchObject({
      librariesDir: path.resolve('/elsewhere'),
      seeds: [{ machineName: 'H5P.Accordion' }, { machineName: 'h5p-column' }],
    });
  });

  it('puts the bump list on stdout, where it survives a pipe', async () => {
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stdout).toContain('H5P.Accordion');
    expect(stdout).toContain('H5P.Column');
    expect(stdout).toContain('1.22');
    expect(stdout).toContain('references H5P.Accordion');
  });

  it('reports only, until --apply', async () => {
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(applyPlan).not.toHaveBeenCalled();
    expect(stderr).toContain('re-run with --apply');
  });

  it('writes the plan under --apply', async () => {
    const plan = samplePlan();
    stubPlan(plan, {
      filesWritten: ['/libs/h5p-column/semantics.json'],
      failures: [],
    });
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion', '--apply']);

    expect(applyPlan).toHaveBeenCalledWith(plan);
    expect(stderr).toContain('1 file(s) written');
    expect(stderr).not.toContain('re-run with --apply');
  });

  it('fails the run when an edit could not be applied', async () => {
    stubPlan(samplePlan(), {
      filesWritten: [],
      failures: [
        {
          relFile: 'h5p-column/semantics.json',
          detail: 'H5P.Accordion 1.2 -> 1.3',
          reason: '"H5P.Accordion 1.2" not found',
        },
      ],
    });
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion', '--apply']);

    expect(stderr).toContain('could not apply h5p-column/semantics.json');
    expect(process.exitCode).toBe(1);
  });

  it('sends warnings to stderr, not into the table', async () => {
    stubPlan(samplePlan({ warnings: ['H5P.Column-1.21 is an older copy'] }));
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('H5P.Column-1.21 is an older copy');
    expect(stdout).not.toContain('older copy');
  });

  it('keeps chains and per-file edits for --verbose', async () => {
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);
    expect(stderr).not.toContain('h5p-column/semantics.json');

    stderr = '';
    ui.setLevel('verbose');
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('via  H5P.Accordion -> H5P.Column');
    expect(stderr).toContain('h5p-column/semantics.json:7');
  });

  it('reports a failure to scan as an error', async () => {
    vi.mocked(scanLibraries).mockImplementationOnce(() => {
      throw new Error('Libraries directory not found: /nope');
    });
    await dependencyCheckCommand().parseAsync(['node', 'h5p', 'H5P.Accordion']);

    expect(stderr).toContain('> error: Libraries directory not found: /nope');
    expect(process.exitCode).toBe(1);
  });
});
