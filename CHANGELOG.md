# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project attempts to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
## [${version}]
### Added - for new features
### Changed - for changes in existing functionality
### Deprecated - for soon-to-be removed features
### Removed - for now removed features
### Fixed - for any bug fixes
### Security - in case of vulnerabilities
[${version}]: https://github.com/joshuadavidthomas/zed-django/releases/tag/v${version}
-->

## [Unreleased]

## [0.2.0]

### Added

- Auto-install `djls` from GitHub releases when not found on PATH

### Fixed

- Fixed binary name default on Windows — the `serverPath` setting now correctly defaults to `djls.exe` on Windows and `djls` on POSIX systems

## [0.1.0]

### Added

- Initial release
- Basic language server integration
- Support for Django templates and Python files
- Configuration options for server path and Django settings

### New Contributors

- Josh Thomas <josh@joshthomas.dev> (maintainer)

[unreleased]: https://github.com/joshuadavidthomas/djls-vscode/compare/v0.2.0...HEAD
[0.1.0]: https://github.com/joshuadavidthomas/djls-vscode/releases/tag/v0.1.0
[0.2.0]: https://github.com/joshuadavidthomas/djls-vscode/releases/tag/v0.2.0
