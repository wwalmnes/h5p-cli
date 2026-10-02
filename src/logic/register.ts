import fs from 'fs';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';
import { getRegistry, registryEntryFromRepoUrl } from './registry.ts';

export const isRepoUrl = (input: string): boolean => ['http', 'git@'].includes(input.slice(0, 4));

/* Adds a library to the local registry file, from its repo URL or from a JSON
file holding a registry entry. Returns the entry that was added. */
export async function register(input: string): Promise<Record<string, any>> {
  const registry = await getRegistry();
  const entry = isRepoUrl(input)
    ? registryEntryFromRepoUrl(input)
    : JSON.parse(fs.readFileSync(input, 'utf-8'));
  registry.reversed = { ...registry.reversed, ...entry };
  fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
  ui.success('updated registry entry');
  ui.data(JSON.stringify(entry, null, 2));
  return entry;
}
