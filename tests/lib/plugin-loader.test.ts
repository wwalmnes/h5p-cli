import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { applyPluginCommands } from '../../src/lib/plugin-loader.ts';

function makeProgram(): Command {
  const program = new Command('h5p');
  program.addCommand(new Command('list').description('built-in list'));
  program.addCommand(new Command('export').description('built-in export'));
  return program;
}

describe('applyPluginCommands', () => {
  it('appends a new command when the name does not collide', () => {
    const program = makeProgram();
    const before = program.commands.length;

    applyPluginCommands(program, [new Command('my-custom').description('plugin custom')]);

    expect(program.commands.length).toBe(before + 1);
    expect(program.commands.find(c => c.name() === 'my-custom')?.description()).toBe('plugin custom');
  });

  it('replaces a built-in command when the name collides', () => {
    const program = makeProgram();
    const before = program.commands.length;

    applyPluginCommands(program, [new Command('list').description('plugin list override')]);

    expect(program.commands.length).toBe(before);
    expect(program.commands.find(c => c.name() === 'list')?.description()).toBe('plugin list override');
  });

  it('replaces multiple built-in commands in one call', () => {
    const program = makeProgram();
    const before = program.commands.length;

    applyPluginCommands(program, [
      new Command('list').description('new list'),
      new Command('export').description('new export'),
    ]);

    expect(program.commands.length).toBe(before);
    expect(program.commands.find(c => c.name() === 'list')?.description()).toBe('new list');
    expect(program.commands.find(c => c.name() === 'export')?.description()).toBe('new export');
  });
});
