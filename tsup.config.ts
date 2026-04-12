import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index':                'src/index.ts',
    'server/server':        'src/server/server.ts',
    'server/api':           'src/server/api.ts',
    'config':               'src/config.ts',
    // SDK entry points for plugins
    'logic':                'logic.ts',
    'configLoader':         'configLoader.ts',
    'utils':                'src/lib/h5p-utils.ts',
    'compute-dependencies': 'src/lib/compute-dependencies.ts',
    'plugin-types':         'src/lib/plugin-types.ts',
  },
  format: ['cjs'],
  outDir: 'dist',
  dts: true,
  splitting: false,
  clean: true,
});
