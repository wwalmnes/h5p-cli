import { Command } from 'commander';
import { z } from 'zod';
import { RegisterAdapter, IRegisterAdapter } from '../adapters/register-adapter';
import { RegisterService } from '../services/register-service';
import { adapterRegistry } from '../lib/adapter-registry';
import config from '../../configLoader';

const registerArgsSchema = z.object({
  input: z.string(),
});

export async function runRegister(input: string): Promise<any> {
  const svc = new RegisterService(
    adapterRegistry.resolve<IRegisterAdapter>('register') ?? new RegisterAdapter(),
    config.registry
  );
  return svc.register(input);
}

export function registerCommand(service?: RegisterService): Command {
  return new Command('register')
    .description('Updates local library registry entry')
    .argument('<input>', 'URL or path to registry file')
    .option('--adapter <name>', 'Use a named adapter from an installed plugin')
    .action(async (input: string, options) => {
      const svc = service ?? new RegisterService(
        adapterRegistry.resolve<IRegisterAdapter>(options.adapter ?? 'register') ?? new RegisterAdapter(),
        config.registry
      );
      const args = registerArgsSchema.parse({ input });
      try {
        await svc.register(args.input);
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
