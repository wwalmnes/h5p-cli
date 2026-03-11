import { Command } from 'commander';
import { z } from 'zod';
import { RegisterAdapter } from '../adapters/register-adapter';
import { RegisterService } from '../services/register-service';
import config from '../../configLoader';

const registerArgsSchema = z.object({
  input: z.string(),
});

export async function runRegister(input: string): Promise<any> {
  const svc = new RegisterService(new RegisterAdapter(), config.registry);
  return svc.register(input);
}

export function registerCommand(service?: RegisterService): Command {
  const svc = service ?? new RegisterService(new RegisterAdapter(), config.registry);
  return new Command('register')
    .description('Updates local library registry entry')
    .argument('<input>', 'URL or path to registry file')
    .action(async (input: string) => {
      const args = registerArgsSchema.parse({ input });
      try {
        await svc.register(args.input);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
