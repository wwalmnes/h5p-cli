import { Command } from 'commander';
import { z } from 'zod';
import { SetupAdapter } from '../adapters/setup-adapter.ts';
import { RegisterAdapter } from '../adapters/register-adapter.ts';
import { RegisterService } from '../services/register-service.ts';
import { SetupService } from '../services/setup-service.ts';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const setupArgsSchema = z.object({
  library: z.string(),
  version: z.string().optional(),
  download: z.string().optional(),
});

export async function runSetup(library: string, version?: string, download?: string): Promise<void> {
  const svc = new SetupService(
    new SetupAdapter(),
    new RegisterService(new RegisterAdapter(), config.registry),
    config.folders.libraries
  );
  await svc.setup(library, version, download);
}

export function setupCommand(service?: SetupService): Command {
  const svc = service ?? new SetupService(
    new SetupAdapter(),
    new RegisterService(new RegisterAdapter(), config.registry),
    config.folders.libraries
  );
  return new Command('setup')
    .description('Computes & installs dependencies for h5p library')
    .argument('<library>', 'Library name or URL')
    .argument('[version]', 'Version')
    .argument('[download]', 'Pass 1 to download instead of clone')
    .action(async (library: string, version: string | undefined, download: string | undefined) => {
      try {
        const args = setupArgsSchema.parse({ library, version, download });
        await svc.setup(args.library, args.version, args.download);
      } catch (error) {
        ui.fail(error);
      }
    });
}
