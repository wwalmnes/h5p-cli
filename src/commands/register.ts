import { Command } from 'commander';
import { z } from 'zod';
import { RegisterAdapter, type IRegisterAdapter } from '../adapters/register-adapter.ts';
import { RegisterService } from '../services/register-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import config from '../../configLoader.ts';
import { ui } from '../lib/ui.ts';

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
      try {
        const args = registerArgsSchema.parse({ input });
        await svc.register(args.input);
      } catch (error) {
        ui.fail(error);
      }
    });
}
