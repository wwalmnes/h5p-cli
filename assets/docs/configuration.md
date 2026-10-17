# Configuration
You can override the default [settings](../../src/config/defaults.ts) by creating a file named `config.js` in your development environment directory (the workspace root).
It exports only the settings you want to change; everything else keeps its default.
## Example
```
module.exports = {
  port: 8081,
  saveFreq: 15,
  files: {
    watch: false
  }
};
```
This runs the dev server on port `8081`, sets the `saveFreq` variable to `15`, and stops the view page from reloading when library files change.

Nested settings such as `files` and `folders` are merged key by key, so `files: { watch: false }` leaves the other `files` settings alone. Any other value, including a list such as `core.clone`, replaces the default outright.

> [!NOTE]
> h5p-cli 1.x expected `config.js` to load the default config with `` require(`${require.main.path}/config.js`) `` and modify it. That no longer works: export only your changes, as above.
