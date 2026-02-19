# djls-vscode

[VS Code](https://code.visualstudio.com) client for [Django Language Server](https://github.com/joshuadavidthomas/django-language-server).

## Requirements

This extension requires the [Django Language Server (`djls`)](https://github.com/joshuadavidthomas/django-language-server).

If `djls` is not found on your PATH, the extension will offer to download and install the latest release automatically. You can also install it manually — see the [djls documentation](https://djls.joshthomas.dev/en/latest/#installation) for instructions.

## Usage

The extension automatically activates when:

- Opening Python files (`.py`)
- Opening Django template files (`.djhtml`, `.dj.html`, `.dj.txt`, `.dj.md`, or files in `templates/` directories)
- Opening a workspace containing `manage.py`

For configuring additional file types like `.html` files in templates directories, see [File Associations](#file-associations).

### Commands

- **Django Language Server: Restart** - Restart the language server
- **Django Language Server: Show Status** - Check if the language server is running

## Configuration

This extension contributes the following settings:

* `djls.serverPath`: Path to the Django Language Server executable (default: `"djls"` on POSIX, `"djls.exe"` on Windows)
* `djls.serverArgs`: Arguments to pass to the Django Language Server command (default: `["serve"]`)
* `djls.djangoSettingsModule`: Django settings module, e.g., `myproject.settings` (default: `""`, uses `DJANGO_SETTINGS_MODULE` env var)
* `djls.venvPath`: Absolute path to virtual environment directory (default: `""`, auto-detects `.venv`, `venv`, `env`, `.env`, or `VIRTUAL_ENV`)
* `djls.pythonPath`: Additional Python paths to include in sys.path (default: `[]`)
* `djls.debug`: Enable debug logging for troubleshooting (default: `false`)
* `djls.trace.server`: Trace server communication for debugging (default: `"off"`)

For more information about configuring the language server, see the [djls configuration documentation](https://djls.joshthomas.dev/en/latest/configuration/).

### File Associations

By default, this extension automatically recognizes:

- Files with `.djhtml`, `.dj.html`, `.dj.txt`, or `.dj.md` extensions
- Any files matching the `*.dj.*` pattern

The language server will also activate for files in `templates/` directories and Python files, though syntax highlighting requires the extensions above or manual configuration via `files.associations`.

#### Using Django syntax in `.html` files

By default, `.html` files use the built-in HTML language. To use Django syntax highlighting in your templates, configure file associations:

##### Per-file (Quick)

Click the language indicator in the status bar (bottom right) and select "Django HTML" or "Django Template".

> **Note:** This only applies to the current session. The file will revert to HTML next time you open it.

##### Django templates directory (Recommended)

Add to your workspace or user `settings.json`:

```json
{
  "files.associations": {
    "**/templates/**/*.html": "django-html"
  }
}
```

This matches all `.html` files in any `templates` directory, following Django's standard project structure.

##### All HTML files (use with caution)

To treat all `.html` files as Django templates:

```json
{
  "files.associations": {
    "*.html": "django-html"
  }
}
```

> **Note:** This will override the built-in HTML language for all `.html` files and may affect non-Django HTML files.

#### Using Django syntax in other file types

Django templates aren't limited to HTML. You can configure associations for any file type.

##### Directory-based matching

Match multiple file types within your templates directory:

```json
{
  "files.associations": {
    "**/templates/**/*.html": "django-html",
    "**/templates/**/*.xml": "django-html",
    "**/templates/**/*.svg": "django-html"
  }
}
```

##### Extension-based matching

Use a `.dj.*` naming convention to mark Django templates:

```json
{
  "files.associations": {
    "*.dj.*": "django-html"
  }
}
```

This matches any file with `.dj.` in the name (e.g., `.dj.html`, `.dj.xml`, `.dj.css`), allowing you to use Django templates with any file extension anywhere in your project.

## Troubleshooting

### Language Server Not Starting

1. If prompted, click "Install" to automatically download `djls`
2. Or check that `djls` is installed manually: `pip show django-language-server`
3. Verify the server path in settings
4. Check the Output panel (View > Output) and select "Django Language Server" for error messages
5. Enable trace logging: Set `djls.trace.server` to `"verbose"`

### No Auto-completion

1. Ensure `djls.djangoSettingsModule` is configured if `DJANGO_SETTINGS_MODULE` isn't set
2. Check that your virtual environment is detected (or configure `djls.venvPath`)
3. Check that the language server is running: Command Palette > "Django Language Server: Show Status"
4. Restart the language server: Command Palette > "Django Language Server: Restart"

## Development

For detailed instructions on setting up a development environment and contributing to this project, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

djls-vscode is licensed under the Apache License, Version 2.0. See the [`LICENSE`](LICENSE) file for more information.

---

djls-vscode is not associated with the Django Software Foundation.

Django is a registered trademark of the Django Software Foundation.
