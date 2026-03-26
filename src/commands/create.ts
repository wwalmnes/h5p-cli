import { Command } from 'commander';
import { z } from 'zod';
import { CreateAdapter, ICreateAdapter } from '../adapters/create-adapter';
import { CreateService } from '../services/create-service';
import { adapterRegistry } from '../lib/adapter-registry';
import config from '../../configLoader';

const createArgsSchema = z.object({
  name: z.string().min(1),
});

export function createCommand(service?: CreateService): Command {
  return new Command('create')
    .description('Scaffold a new H5P content type in the libraries folder')
    .argument('<name>', 'Content type name (e.g. MyContentType)')
    .action((name: string) => {
      const svc = service ?? new CreateService(
        adapterRegistry.resolve<ICreateAdapter>('create') ?? new CreateAdapter(),
        config.folders.libraries
      );
      const args = createArgsSchema.parse({ name });
      try {
        svc.create(args.name);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
