import path from 'path';
import type { ICreateAdapter } from '../adapters/create-adapter.ts';
import type { Logger } from '../lib/repo-types.ts';

export class CreateService {
  private adapter: ICreateAdapter;
  private librariesFolder: string;
  private logger: Logger;

  constructor(adapter: ICreateAdapter, librariesFolder: string, logger: Logger = console) {
    this.adapter = adapter;
    this.librariesFolder = librariesFolder;
    this.logger = logger;
  }

  create(name: string): void {
    const machineName = `H5P.${name}`;
    const dirName = `${machineName}-1.0`;
    const dir = path.join(process.cwd(), this.librariesFolder, dirName);

    if (this.adapter.exists(dir)) {
      this.logger.log(`> already exists: ${dir}`);
      return;
    }

    this.adapter.mkdirSync(dir);

    const libraryJson = {
      title: name,
      description: '',
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      runnable: 1,
      author: '',
      license: 'MIT',
      machineName,
      preloadedJs: [{ path: 'index.js' }],
    };
    this.adapter.writeFile(
      path.join(dir, 'library.json'),
      JSON.stringify(libraryJson, null, 2)
    );

    const semantics = [
      { name: 'greeting', label: 'Greeting', type: 'text', default: 'Hello world!' },
    ];
    this.adapter.writeFile(
      path.join(dir, 'semantics.json'),
      JSON.stringify(semantics, null, 2)
    );

    const indexJs = `var H5P = H5P || {};

H5P.${name} = (function ($) {
  function C(options, id) {
    this.options = options;
    this.id = id;
  }

  C.prototype.attach = function ($container) {
    console.log('hello world');
  };

  return C;
})(H5P.jQuery);
`;
    this.adapter.writeFile(path.join(dir, 'index.js'), indexJs);

    this.logger.log(`> created ${dir}`);
  }
}
