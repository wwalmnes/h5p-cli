import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';
import { Command } from 'commander';
import { createEmptyProject, createSeededProject, type Fixture } from '../helpers/fixture.ts';
import { guardTopLevelCommands } from '../../src/lib/workspace.ts';
import { applyPluginCommands } from '../../src/lib/plugin-loader.ts';

// `utils list` is exempt from the guard, so it must reach its adapter. Stub the network.
vi.mock('../../src/adapters/repo-discovery-adapter.ts', () => ({
  RepoDiscoveryAdapter: class {
    fetchRegistry = vi.fn(async () => ({ 'H5P.Accordion': { repository: 'h5p/h5p-accordion' } }));
  },
}));

const { gitCommand } = await import('../../src/commands/git/index.ts');
const { utilsCommand } = await import('../../src/commands/utils/index.ts');

class Exit extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

describe('working directory guard — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stderr: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Exit(code);
    }) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('stops "git status" run from the workspace root and points at libraries/', async () => {
    fixture = createSeededProject(['H5P.Accordion-1.0']);
    process.chdir(fixture.dir);

    await expect(gitCommand().parseAsync(['node', 'h5p', 'status'])).rejects.toThrow(Exit);
    expect(stderr).toContain('No git repositories found');
    expect(stderr).toContain('cd libraries');
  });

  it('stops "utils validate" run from the workspace root', async () => {
    fixture = createSeededProject(['H5P.Accordion-1.0']);
    process.chdir(fixture.dir);

    await expect(utilsCommand().parseAsync(['node', 'h5p', 'validate', 'h5p-accordion'])).rejects.toThrow(Exit);
    expect(stderr).toContain('No git repositories found');
  });

  it('lets "utils list" through — it touches no files', async () => {
    fixture = createEmptyProject();
    process.chdir(fixture.dir);

    await expect(utilsCommand().parseAsync(['node', 'h5p', 'list'])).resolves.toBeDefined();
    expect(stderr).not.toContain('No git repositories found');
  });
});

describe('top-level guard — plugin commands', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stderr: string;

  // Mirrors src/index.ts: built-ins first, plugin commands applied over them, then the guard.
  function program(pluginCommands: Command[]): Command {
    const h5p = new Command('h5p');
    h5p.addCommand(new Command('setup').action(() => {}));
    applyPluginCommands(h5p, pluginCommands);
    guardTopLevelCommands(h5p, ['core'], pluginCommands);
    return h5p;
  }

  beforeEach(() => {
    originalCwd = process.cwd();
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Exit(code);
    }) as never);
    fixture = createEmptyProject();
    process.chdir(fixture.dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('lets a plugin command run outside a workspace', async () => {
    const h5p = program([new Command('greet').action(() => {})]);

    await expect(h5p.parseAsync(['node', 'h5p', 'greet'])).resolves.toBeDefined();
    expect(stderr).not.toContain('No "libraries" folder');
  });

  it('lets a plugin command that replaces a built-in run outside a workspace', async () => {
    const h5p = program([new Command('setup').action(() => {})]);

    await expect(h5p.parseAsync(['node', 'h5p', 'setup'])).resolves.toBeDefined();
    expect(stderr).not.toContain('No "libraries" folder');
  });

  it('still stops a built-in command outside a workspace', async () => {
    const h5p = program([new Command('greet').action(() => {})]);

    await expect(h5p.parseAsync(['node', 'h5p', 'setup'])).rejects.toThrow(Exit);
    expect(stderr).toContain('No "libraries" folder here');
  });
});

// `src/index.ts` parses argv at import time, so the top-level guard is exercised through the real binary.
const H5P = path.resolve(import.meta.dirname, '../../h5p.js');

function h5p(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [H5P, ...args], { cwd, encoding: 'utf-8' });
}

describe('top-level guard — help from outside a workspace', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createEmptyProject();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it.each(['setup --help', 'setup -h', '--verbose setup --help'])('shows help for "h5p %s"', (args) => {
    const result = h5p(fixture.dir, args.split(' '));

    expect(result.stderr).not.toContain('No "libraries" folder');
    expect(result.stdout).toContain('Usage: h5p setup');
    expect(result.status).toBe(0);
  });

  it('still stops "setup" itself', () => {
    const result = h5p(fixture.dir, ['setup', 'h5p-foo']);

    expect(result.stderr).toContain('No "libraries" folder here');
    expect(result.status).toBe(1);
  });
});
