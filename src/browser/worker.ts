import init, { LanguageServer, registerDjango } from "djls-wasm";
import {
	BrowserMessageReader,
	BrowserMessageWriter,
	type Message,
	type RequestMessage,
} from "vscode-jsonrpc/browser";

// Runs django-language-server compiled to wasm. The extension host posts a bootstrap message
// with the wasm and Django zip URLs first; every later message is LSP, handed to the server one
// at a time. Writes post synchronously, so replies keep the order the server produced them in.

declare const self: DedicatedWorkerGlobalScope;

interface Bootstrap {
	method: "djls/bootstrap";
	params: { wasmUrl: string; djangoUrl: string };
}

const reader = new BrowserMessageReader(self);
const writer = new BrowserMessageWriter(self);

async function load({ wasmUrl, djangoUrl }: Bootstrap["params"]) {
	await init({ module_or_path: wasmUrl });
	const response = await fetch(djangoUrl);
	if (!response.ok) {
		throw new Error(`Fetching ${djangoUrl} failed: ${response.status}`);
	}
	registerDjango(new Uint8Array(await response.arrayBuffer()));
	return new LanguageServer();
}

let server: Promise<LanguageServer> | undefined;

// Messages that arrive while the server loads wait on the same promise, so they are handled
// in arrival order.
reader.listen(async (message) => {
	if (!server) {
		server = load((message as unknown as Bootstrap).params);
		return;
	}
	let outgoing: Message[];
	try {
		const languageServer = await server;
		outgoing = JSON.parse(languageServer.handle(JSON.stringify(message)));
	} catch (error) {
		console.error("django-language-server:", error);
		const request = message as RequestMessage;
		outgoing =
			request.id !== undefined && request.method !== undefined
				? [
						{
							jsonrpc: "2.0",
							id: request.id,
							error: {
								code: -32603,
								message: `django-language-server: ${error}`,
							},
						} as Message,
					]
				: [];
	}
	for (const reply of outgoing) void writer.write(reply);
});
