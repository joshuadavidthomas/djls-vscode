// The wasm-bindgen `--target web` output of django-language-server's djls-wasm crate. esbuild
// resolves this module to wasm/djls_wasm.js, or to the stub when that file is missing.
declare module "djls-wasm" {
	export default function init(options: {
		module_or_path: string | URL | Response | BufferSource;
	}): Promise<unknown>;
	/** Registers the bundled Django source; call before creating a server. */
	export function registerDjango(bytes: Uint8Array): string;
	export class LanguageServer {
		/** Takes one JSON-RPC message; returns a JSON array of outgoing messages. */
		handle(message: string): string;
	}
}
