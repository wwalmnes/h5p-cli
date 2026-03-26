import { Command } from 'commander';
import { CoreAdapter, ICoreAdapter } from '../adapters/core-adapter';
import { CoreService } from '../services/core-service';
import { SetupAdapter, ISetupAdapter } from '../adapters/setup-adapter';
import { RegisterAdapter, IRegisterAdapter } from '../adapters/register-adapter';
import { RegisterService } from '../services/register-service';
import { SetupService } from '../services/setup-service';
import { adapterRegistry } from '../lib/adapter-registry';
import config from '../../configLoader';

export function coreCommand(service?: CoreService): Command {
  return new Command('core')
    .description('Installs core h5p libraries')
    .action(async () => {
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
