import { Command } from 'commander';
import { z } from 'zod';
import * as fs from 'fs';

const registerArgsSchema = z.object({
  input: z.string(),
});

export async function runRegister(input: string): Promise<any> {
  const logic = require('../../logic.js') as any;
  const config = require('../../configLoader.js') as any;
  const isUrl = ['http', 'git@'].includes(input.slice(0, 4));
  let registry = await logic.getRegistry();
  const entry = isUrl
    ? await logic.registryEntryFromRepoUrl(input)
    : JSON.parse(fs.readFileSync(input, 'utf-8'));
  registry.reversed = { ...registry.reversed, ...entry };
  fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
  console.log('> updated registry entry');
  console.log(entry);
  return entry;
}

export function registerCommand(): Command {
  return new Command('register')
    .description('Updates local library registry entry')
    .argument('<input>', 'URL or path to registry file')
    .action(async (input: string) => {
      const args = registerArgsSchema.parse({ input });
      try {
        await runRegister(args.input);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
