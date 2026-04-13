import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Command } from 'commander';
import { adapterRegistry } from './adapter-registry.ts';
import type { H5PPlugin } from './plugin-types.ts';

const H5P_CLI_ROOT = path.resolve(import.meta.dirname, '..', '..');

export async function loadPlugins(program: Command): Promise<void> {
  const filePath = path.join(H5P_CLI_ROOT, 'h5p.plugins.json');
  if (!fs.existsSync(filePath)) return;

  let config: { plugins?: Array<{ name: string; path: string }> };
  try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`[h5p] Failed to parse h5p.plugins.json:`, e);
    return;
  }

  if (!Array.isArray(config.plugins)) return;

  for (const entry of config.plugins) {
    try {
      const pluginPackage = JSON.parse(fs.readFileSync(path.resolve(entry.path, 'package.json'), 'utf-8'));
      await loadPlugin(path.resolve(entry.path, pluginPackage.main), program);
    } catch (e) {
      console.error(`[h5p] Failed to read package.json from plugin: `, e);
    }
  }
}

export function applyPluginCommands(program: Command, commands: Command[]): void {
  for (const cmd of commands) {
    const idx = program.commands.findIndex(c => c.name() === cmd.name());
    if (idx !== -1 && Array.isArray(program.commands)) {
      program.commands.splice(idx, 1);
    }
    program.addCommand(cmd);
  }
}

async function loadPlugin(ref: string, program: Command): Promise<void> {
  let plugin: H5PPlugin;
  try {
    // all stored refs are absolute paths
    const mod = await import(pathToFileURL(ref).href);
    plugin = mod.default ?? mod;
  } catch (e) {
    console.error(`[h5p] Failed to load plugin "${ref}":`, e);
    return;
  }

  if (!plugin || typeof plugin !== 'object' || !plugin.name) {
    console.error(`[h5p] Plugin "${ref}" does not export a valid H5PPlugin object`);
    return;
  }

  if (typeof plugin.adapters === 'function') {
    try {
      adapterRegistry.register(plugin.adapters());
    } catch (e) {
      console.error(`[h5p] Plugin "${plugin.name}" adapters() threw:`, e);
    }
  }

  if (typeof plugin.commands === 'function') {
    try {
      applyPluginCommands(program, plugin.commands());
    } catch (e) {
      console.error(`[h5p] Plugin "${plugin.name}" commands() threw:`, e);
    }
  }
}
