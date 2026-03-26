import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { adapterRegistry } from './adapter-registry';
import { H5PPlugin } from './plugin-types';

const H5P_CLI_ROOT = path.resolve(__dirname, '..');

export function loadPlugins(program: Command): void {
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
    loadPlugin(entry.path, program);
  }
}

function loadPlugin(ref: string, program: Command): void {
  let plugin: H5PPlugin;
  try {
    // all stored refs are absolute paths
    const mod = require(ref);
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
      for (const cmd of plugin.commands()) {
        program.addCommand(cmd);
      }
    } catch (e) {
      console.error(`[h5p] Plugin "${plugin.name}" commands() threw:`, e);
    }
  }
}
