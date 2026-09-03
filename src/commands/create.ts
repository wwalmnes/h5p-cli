import { Command } from 'commander';
import { z } from 'zod';
import { CreateAdapter, type ICreateAdapter } from '../adapters/create-adapter.ts';
import { CreateService } from '../services/create-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

const createArgsSchema = z.object({
  name: z.string().min(1),
});

export function createCommand(service?: CreateService): Command {
  return new Command('create')
    .description('Scaffold a new H5P content type in the libraries folder')
    .argument('<name>', 'Content type name (e.g. MyContentType)')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action((name: string, options) => {
      const svc = service ?? new CreateService(
        adapterRegistry.resolve<ICreateAdapter>(options.adapter ?? 'create') ?? new CreateAdapter(),
        config.folders.libraries
      );
      try {
        const args = createArgsSchema.parse({ name });
        svc.create(args.name);
      } catch (error) {
        ui.fail(error);
      }
    });
}
