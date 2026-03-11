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
    const mockSvc = { verify: vi.fn().mockResolvedValue(undefined) } as any;
    expect(verifyCommand(mockSvc).name()).toBe('verify');
  });

  it('calls service.verify with library', async () => {
    const mockSvc = { verify: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = verifyCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.verify).toHaveBeenCalledWith('h5p-blanks');
  });

  it('logs error on rejection', async () => {
    const mockSvc = { verify: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const cmd = verifyCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
