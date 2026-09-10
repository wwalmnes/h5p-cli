import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreService } from '../../src/services/core-service.ts';
import type { ICoreAdapter } from '../../src/adapters/core-adapter.ts';

const CLONE = ['h5p-editor-php-library', 'h5p-php-library'];
const SETUP = [{ repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' }];

function makeAdapter(): ICoreAdapter & { installCore: ReturnType<typeof vi.fn> } {
  return { installCore: vi.fn().mockResolvedValue([]) };
}

describe('CoreService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  /* One call, so one pool. The clone half and the library half used to be two
  sequential phases, which is what made the command take their sum. */
  it('hands every repo to the adapter in a single call', async () => {
    const adapter = makeAdapter();
    await new CoreService(adapter, CLONE, SETUP, logger).core();

    expect(adapter.installCore).toHaveBeenCalledTimes(1);
    expect(adapter.installCore.mock.calls[0][0]).toEqual([
      { org: 'h5p', repo: 'h5p-editor-php-library', target: 'h5p-editor-php-library' },
      { org: 'h5p', repo: 'h5p-php-library', target: 'h5p-php-library' },
      { org: 'h5p', repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' },
    ]);
  });

  /* A library entry carries no target: its folder is <machineName>-<major>.<minor>,
  and the version is only knowable once the repo is cloned. */
  it('marks library entries by machineName, not by a fixed folder', async () => {
    const adapter = makeAdapter();
    await new CoreService(adapter, [], SETUP, logger).core();

    const [item] = adapter.installCore.mock.calls[0][0];
    expect(item.machineName).toBe('H5P.MathDisplay');
    expect(item.target).toBeUndefined();
  });

  it('asks for a refresh of already-installed repos', async () => {
    const adapter = makeAdapter();
    await new CoreService(adapter, CLONE, SETUP, logger).core();

    // latest = true is what reaches _update rather than a bare skip
    expect(adapter.installCore.mock.calls[0][1]).toBe(true);
  });

  it('threads concurrency through', async () => {
    const adapter = makeAdapter();
    await new CoreService(adapter, CLONE, SETUP, logger).core(8);

    expect(adapter.installCore.mock.calls[0][2]).toBe(8);
  });

  it('logs done message', async () => {
    await new CoreService(makeAdapter(), [], [], logger).core();
    expect(logger.log).toHaveBeenCalledWith('> done setting up core libraries');
  });

  it('propagates a failure without reporting success', async () => {
    const adapter = makeAdapter();
    adapter.installCore.mockRejectedValue(new Error('clone failed'));
    const svc = new CoreService(adapter, CLONE, SETUP, logger);

    await expect(svc.core()).rejects.toThrow('clone failed');
    expect(logger.log).not.toHaveBeenCalledWith('> done setting up core libraries');
  });
});
