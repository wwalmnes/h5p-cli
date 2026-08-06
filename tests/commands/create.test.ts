import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCommand } from '../../src/commands/create.ts';

vi.mock('../../configLoader', () => ({
  default: { folders: { libraries: 'libraries' } },
}));

describe('createCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    const mockSvc = { create: vi.fn() } as any;
    expect(createCommand(mockSvc).name()).toBe('create');
  });

  it('calls service.create with the name argument', async () => {
    const mockSvc = { create: vi.fn() } as any;
    const cmd = createCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'MyContentType']);
    expect(mockSvc.create).toHaveBeenCalledWith('MyContentType');
  });

  it('logs error on exception', async () => {
    const mockSvc = { create: vi.fn().mockImplementation(() => { throw new Error('boom'); }) } as any;
    const cmd = createCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'MyContentType']);
    expect(stderr).toContain('> error: boom');
  });
});
