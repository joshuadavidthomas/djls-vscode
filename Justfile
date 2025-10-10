set dotenv-load := true
set unstable := true

# List all available commands
[private]
default:
    @just --list --list-submodules

bumpver *ARGS:
    uvx bumpver {{ ARGS }}

test *ARGS:
    xvfb-run -a bun run test {{ ARGS }}
