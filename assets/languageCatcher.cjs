const fs = require('fs');
// configLoader.ts in the repo, configLoader.js in the published (compiled) package
const _configLoader = [`${__dirname}/../configLoader.ts`, `${__dirname}/../configLoader.js`].find(fs.existsSync);
const config = require(_configLoader).default;
// scaffolding for h5peditor.js
global.window = {
  parent: {
    H5PEditor: {}
  }
};
global.H5P = {
  jQuery: {
    extend: () => {
      return {};
    }
  }
};
global.ns = {};
try {
  global.navigator = {
    userAgent: {
      match: () => {}
    }
  };
} catch (_) {
  // Node.js 21+ exposes navigator as a read-only getter; the real
  // navigator.userAgent string already has .match(), so no mock needed
}
require(`${process.cwd()}/${config.folders.libraries}/h5p-editor-php-library/scripts/h5peditor.js`);
module.exports = ns.supportedLanguages;
// remove scaffolding
delete global.window;
delete global.H5P;
delete global.ns;
try { delete global.navigator; } catch (_) {}
