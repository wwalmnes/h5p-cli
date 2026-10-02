import fs from 'fs';
import path from 'path';
import { registerHooks } from 'module';
import { pathToFileURL } from 'url';
import { Command } from 'commander';
import type { H5PPlugin } from './plugin-types.ts';
import type { PluginsConfig } from './plugins.ts';
import { pluginHome } from './plugin-home.ts';
import { ui } from './ui.ts';

/* Plugins declare h5p-cli and commander as peer dependencies, but Node never reads
that: it resolves a bare specifier by walking up from the importing file. A plugin
outside the CLI's folder therefore finds no copy at all, or, after `npm install`, a
copy of its own, whose separate `ui` ignores --quiet/--verbose and the progress area.
Resolving both as if the CLI had imported them gives every plugin the CLI's own
instances, wherever it lives. `h5p-cli/<subpath>` resolves through the CLI's own
package.json exports (a self-reference), so it is the same file the CLI loaded. */
const SHARED_PEERS = /^(h5p-cli|commander)(\/|$)/;
let peersShared = false;

export function sharePeerDependencies(): void {
  if (peersShared) return;
  peersShared = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return SHARED_PEERS.test(specifier)
        ? nextResolve(specifier, { ...context, parentURL: import.meta.url })
        : nextResolve(specifier, context);
    },
  });
}

/** Load every installed plugin and return the commands they added to `program`. */
export async function loadPlugins(program: Command): Promise<Command[]> {
  const filePath = path.join(pluginHome(), 'h5p.plugins.json');
  if (!fs.existsSync(filePath)) return [];
  sharePeerDependencies();

  let config: Partial<PluginsConfig>;
  try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    ui.warn(`[h5p] Failed to parse h5p.plugins.json`);
    ui.error(e);
    return [];
  }

  if (!Array.isArray(config.plugins)) return [];

  const commands: Command[] = [];
  for (const entry of config.plugins) {
    try {
      const file = resolvePluginEntry(entry.path);
      if (!file) {
        ui.warn(`[h5p] Plugin "${entry.name}" has no entry point (exports, main or index.js) in ${entry.path}`);
        continue;
      }
      commands.push(...await loadPlugin(file, program));
    } catch (e) {
      // e.g. the plugin's folder was removed after it was installed
      ui.warn(`[h5p] Plugin "${entry.name}" could not be loaded from ${entry.path}`);
      ui.error(e);
    }
  }
  return commands;
}

/* The file a plugin's stored path points at: the path itself, or a folder's entry point,
found the way Node would for a package - exports["."] (a string, or its import, default
or node condition), then main, then index.js/.mjs/.ts. Nested conditions are not
followed; such a plugin falls through to main. Install and load both use this, so a
plugin that installs also loads. */
export function resolvePluginEntry(absPath: string): string | undefined {
  if (!fs.statSync(absPath).isDirectory()) return absPath;
  const pkgPath = path.join(absPath, 'package.json');
  let entry: unknown;
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const exp = pkg.exports?.['.'] ?? pkg.exports;
    entry = typeof exp === 'string' ? exp : exp?.import ?? exp?.default ?? exp?.node;
    if (typeof entry !== 'string') entry = pkg.main;
  }
  const candidates = typeof entry === 'string' ? [entry] : ['index.js', 'index.mjs', 'index.ts'];
  for (const candidate of candidates) {
    const full = path.join(absPath, candidate);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
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

async function loadPlugin(ref: string, program: Command): Promise<Command[]> {
  let plugin: H5PPlugin;
  try {
    // all stored refs are absolute paths
    const mod = await import(pathToFileURL(ref).href);
    plugin = mod.default ?? mod;
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING') {
      ui.warn(`[h5p] Plugin "${ref}" is TypeScript inside a node_modules folder, which Node will not run. ` +
        'Install it from a path outside node_modules, or ship it as JavaScript.');
      return [];
    }
    ui.warn(`[h5p] Failed to load plugin "${ref}"`);
    ui.error(e);
    return [];
  }

  if (!plugin || typeof plugin !== 'object' || !plugin.name) {
    ui.warn(`[h5p] Plugin "${ref}" does not export a valid H5PPlugin object`);
    return [];
  }

  if (typeof plugin.commands === 'function') {
    try {
      const commands = plugin.commands();
      applyPluginCommands(program, commands);
      return commands;
    } catch (e) {
      ui.warn(`[h5p] Plugin "${plugin.name}" commands() threw`);
      ui.error(e);
    }
  }

  return [];
}
