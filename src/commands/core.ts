import { Command } from 'commander';
import { CoreAdapter, type ICoreAdapter } from '../adapters/core-adapter.ts';
import { CoreService } from '../services/core-service.ts';
import { SetupAdapter, type ISetupAdapter } from '../adapters/setup-adapter.ts';
import { RegisterAdapter, type IRegisterAdapter } from '../adapters/register-adapter.ts';
import { RegisterService } from '../services/register-service.ts';
import { SetupService } from '../services/setup-service.ts';
import { adapterRegistry } from '../lib/adapter-registry.ts';
import config from '../../configLoader.ts';
import { setupFolders } from '../lib/setup-folders.ts';

export function coreCommand(service?: CoreService): Command {
  return new Command('core')
    .description('Installs core h5p libraries')
    .action(async () => {
      setupFolders();
      const svc = service ?? new CoreService(
        adapterRegistry.resolve<ICoreAdapter>('core') ?? new CoreAdapter(),
        new SetupService(
          adapterRegistry.resolve<ISetupAdapter>('setup') ?? new SetupAdapter(),
          new RegisterService(
            adapterRegistry.resolve<IRegisterAdapter>('register') ?? new RegisterAdapter(),
            config.registry
          ),
          config.folders.libraries
        ),
        config.core.clone,
        config.core.setup,
        config.folders.libraries
      );
      try {
        await svc.core();
      } catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
}
