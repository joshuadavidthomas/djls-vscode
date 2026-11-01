# Contributing

All contributions are welcome! Besides code contributions, this includes things like documentation improvements, bug reports, and feature requests.

You should first check if there is a [GitHub issue](https://github.com/joshuadavidthomas/djls-vscode/issues) already open or related to what you would like to contribute. If there is, please comment on that issue to let others know you are working on it. If there is not, please open a new issue to discuss your contribution.

Not all contributions need to start with an issue, such as typo fixes in documentation or version bumps to Python or Django that require no internal code changes, but generally, it is a good idea to open an issue first.

We adhere to Django's Code of Conduct in all interactions and expect all contributors to do the same. Please read the [Code of Conduct](https://www.djangoproject.com/conduct/) before contributing.

## Development

### Building the Extension

```bash
# Install dependencies
bun install

# Compile
bun run compile

# Watch for changes
bun run watch

# Package for distribution
bun run package
```

### Testing

The extension tests run in an actual VSCode instance, which requires a display. On Linux, we use `xvfb-run` to provide a virtual display for headless testing.

```bash
# Run tests (Linux)
xvfb-run -a bun run test

# Or use the Just recipe
just test

# macOS doesn't require xvfb
bun run test
```

### VS Code for the Web

The `browser` entry (`src/browser/`) runs djls-wasm in a web worker. Put the wasm-bindgen `--target web` output of django-language-server's `djls-wasm` crate (`djls_wasm.js`, `djls_wasm_bg.wasm`) and a stored Django zip named `django.zip` in `wasm/`; the build copies them into `dist/browser/`. Without `wasm/djls_wasm.js`, the build uses a stub server (`src/browser/stub/`) that recognizes a few tags, which is enough to exercise the plumbing.

```bash
# Opens test-fixtures/django-project in VS Code for the Web on http://localhost:3000
bun run test:web
```

To try the extension in vscode.dev itself, serve the repository root over `http://localhost` (vscode.dev's Content Security Policy allows `localhost` but not arbitrary hosts) with `Access-Control-Allow-Origin: *`, then run **Developer: Install Extension from Location...** with that URL.
