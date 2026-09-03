import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateService } from '../../src/services/create-service.ts';
import type { ICreateAdapter } from '../../src/adapters/create-adapter.ts';
import path from 'path';

function makeAdapter(overrides: Partial<ICreateAdapter> = {}): ICreateAdapter {
  return {
    exists: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFile: vi.fn(),
    ...overrides,
  };
}

/** Content written to the first file whose path ends with `suffix`. */
function writtenFile(adapter: ICreateAdapter, suffix: string): string {
  const call = (adapter.writeFile as ReturnType<typeof vi.fn>).mock.calls.find(
    (args: unknown[]) => String(args[0]).endsWith(suffix)
  );
  if (!call) throw new Error(`no file was written ending in "${suffix}"`);
  return String(call[1]);
}

describe('CreateService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };
  const librariesFolder = 'libraries';

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('creates directory and 3 files for a new content type', () => {
    const adapter = makeAdapter();
    const svc = new CreateService(adapter, librariesFolder, logger);
    svc.create('MyContentType');
    const expectedDir = path.join(process.cwd(), librariesFolder, 'H5P.MyContentType-1.0');
    expect(adapter.mkdirSync).toHaveBeenCalledWith(expectedDir);
    expect(adapter.writeFile).toHaveBeenCalledTimes(3);
    expect(adapter.writeFile).toHaveBeenCalledWith(path.join(expectedDir, 'library.json'), expect.any(String));
    expect(adapter.writeFile).toHaveBeenCalledWith(path.join(expectedDir, 'semantics.json'), expect.any(String));
    expect(adapter.writeFile).toHaveBeenCalledWith(path.join(expectedDir, 'index.js'), expect.any(String));
    expect(logger.log).toHaveBeenCalledWith(`> created ${expectedDir}`);
  });

  it('writes correct machineName in library.json', () => {
    const adapter = makeAdapter();
    const svc = new CreateService(adapter, librariesFolder, logger);
    svc.create('MyContentType');
    const parsed = JSON.parse(writtenFile(adapter, 'library.json'));
    expect(parsed.machineName).toBe('H5P.MyContentType');
    expect(parsed.preloadedJs).toEqual([{ path: 'index.js' }]);
  });

  it('logs already exists and does not scaffold when dir exists', () => {
    const adapter = makeAdapter({ exists: vi.fn().mockReturnValue(true) });
    const svc = new CreateService(adapter, librariesFolder, logger);
    svc.create('MyContentType');
    expect(adapter.mkdirSync).not.toHaveBeenCalled();
    expect(adapter.writeFile).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('includes H5P.Name in generated index.js', () => {
    const adapter = makeAdapter();
    const svc = new CreateService(adapter, librariesFolder, logger);
    svc.create('MyContentType');
    expect(writtenFile(adapter, 'index.js')).toContain('H5P.MyContentType');
  });
});
