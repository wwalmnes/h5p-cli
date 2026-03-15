import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture';
import logic from '../../logic';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('logic.tags', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git tag') return Buffer.from('1.14.1\n1.14.0\n1.15.0\n1.13.5\n');
      return Buffer.from('');
    });

    // Pre-create temp dir so getRepoFile skips git clone
    fs.mkdirSync('temp/h5p-blanks_master', { recursive: true });
    fs.writeFileSync(
      'temp/h5p-blanks_master/library.json',
      JSON.stringify({ machineName: 'H5P.Blanks', title: 'Fill in the Blanks' }),
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns tags sorted descending by semver', () => {
    const tags = logic.tags('h5p', 'h5p-blanks');
    expect(tags).toEqual(['1.15.0', '1.14.1', '1.14.0', '1.13.5']);
  });

  it('filters out empty strings from git tag output', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git tag') return Buffer.from('\n1.0.0\n\n2.0.0\n');
      return Buffer.from('');
    });
    const tags = logic.tags('h5p', 'h5p-blanks');
    expect(tags).not.toContain('');
    expect(tags).toEqual(['2.0.0', '1.0.0']);
  });
});
