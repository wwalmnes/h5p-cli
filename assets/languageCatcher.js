const fs = require('fs');
const _userConfig = `${process.cwd()}/config.js`;
const _bundleConfig = `${require.main.path}/config.js`;
const config = fs.existsSync(_userConfig) ? require(_userConfig) : require(_bundleConfig);
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
