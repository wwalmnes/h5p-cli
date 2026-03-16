import { Command } from 'commander';
import { z } from 'zod';
import { CreateAdapter } from '../adapters/create-adapter';
import { CreateService } from '../services/create-service';
import config from '../../configLoader';

const createArgsSchema = z.object({
  name: z.string().min(1),
});

export function createCommand(service?: CreateService): Command {
  const svc = service ?? new CreateService(new CreateAdapter(), config.folders.libraries);
  return new Command('create')
    .description('Scaffold a new H5P content type in the libraries folder')
    .argument('<name>', 'Content type name (e.g. MyContentType)')
    .action((name: string) => {
      const args = createArgsSchema.parse({ name });
      try {
        svc.create(args.name);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
