import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyCommand } from '../../src/commands/verify';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { verifySetup: vi.fn() },
}));

describe('verifyCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockAdapter = { verifySetup: vi.fn().mockResolvedValue(undefined) } as any;
    expect(verifyCommand(mockAdapter).name()).toBe('verify');
  });

  it('calls adapter.verifySetup with library', async () => {
    const mockAdapter = { verifySetup: vi.fn().mockResolvedValue('ok') } as any;
    const cmd = verifyCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.verifySetup).toHaveBeenCalledWith('h5p-blanks');
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { verifySetup: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const cmd = verifyCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
