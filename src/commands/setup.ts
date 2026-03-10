import { Command } from 'commander';
import { z } from 'zod';
import * as fs from 'fs';
import { runRegister } from './register';
import logic from '../../logic';
import config from '../../configLoader';

const setupArgsSchema = z.object({
  library: z.string(),
  version: z.string().optional(),
  download: z.string().optional(),
});

const handleMissingOptionals = (missingOptionals: Record<string, any>, result: any, item: string) => {
  if (result[item].optional) {
    if (!missingOptionals[item]) {
      missingOptionals[item] = result[item];
    }
  } else {
    throw new Error(`unregistered ${item} library required by ${result[item].parent}`);
  }
};

export async function runSetup(library: string, version?: string, download?: string): Promise<void> {
  const isUrl = ['http', 'git@'].includes(library.slice(0, 4));
  const url = library;
  const missingOptionals: Record<string, any> = {};

  if (isUrl) {
    const entry = await runRegister(url);
    library = logic.machineToShort(Object.keys(entry)[0]);
  }
  let toSkip: string[] = [];
  const action = parseInt(download ?? '0') ? 'download' : 'clone';
  const latest = version ? false : true;
  let result = await logic.computeDependencies(library, 'view', version);
  for (const item in result) {
    if (!result[item].id) {
      handleMissingOptionals(missingOptionals, result, item);
    } else {
      toSkip = await logic.getWithDependencies(action, item, 'edit', latest, toSkip);
    }
  }
  result = await logic.computeDependencies(library, 'edit', version);
  for (const item in result) {
    if (!result[item].id) {
      handleMissingOptionals(missingOptionals, result, item);
    }
  }
  toSkip = [];
  console.log(`> ${action} ${library} library "view" dependencies into "${config.folders.libraries}" folder`);
  toSkip = await logic.getWithDependencies(action, library, 'view', latest, toSkip);
  console.log(`> ${action} ${library} library "edit" dependencies into "${config.folders.libraries}" folder`);
  toSkip = await logic.getWithDependencies(action, library, 'edit', latest, toSkip);
  if (Object.keys(missingOptionals).length) {
    console.log('!!! missing optional libraries');
    for (const item in missingOptionals) {
      console.log(`${item} (${missingOptionals[item].optional ? 'optional' : 'required'}) required by ${missingOptionals[item].parent}`);
    }
  }
  console.log(`> done setting up ${library}`);
}

export function setupCommand(): Command {
  return new Command('setup')
    .description('Computes & installs dependencies for h5p library')
    .argument('<library>', 'Library name or URL')
    .argument('[version]', 'Version')
    .argument('[download]', 'Pass 1 to download instead of clone')
    .action(async (library: string, version: string | undefined, download: string | undefined) => {
      const args = setupArgsSchema.parse({ library, version, download });
      try {
        await runSetup(args.library, args.version, args.download);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
