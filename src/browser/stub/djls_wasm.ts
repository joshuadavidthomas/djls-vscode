// A stand-in for djls-wasm with the same API, used when wasm/djls_wasm.js is missing so the
// browser plumbing (bootstrap, file sync, diagnostics, completions, hover) can be exercised
// without the real server. It knows only a few builtin tags and the tags registered with
// `@register.simple_tag` / `@register.tag` in `templatetags/<library>.py` files.

const BUILTIN_TAGS = [
	"block",
	"endblock",
	"extends",
	"for",
	"endfor",
	"if",
	"endif",
	"include",
	"load",
	"url",
	"csrf_token",
	"comment",
	"endcomment",
];

interface Rpc {
	id?: number | string;
	method?: string;
	params?: Record<string, unknown>;
}

export default async function init(_options: unknown): Promise<void> {}

let djangoBytes = 0;
export function registerDjango(bytes: Uint8Array): string {
	djangoBytes = bytes.byteLength;
	return "stub";
}

export class LanguageServer {
	private files = new Map<string, string>();

	handle(raw: string): string {
		const message = JSON.parse(raw) as Rpc;
		const out: unknown[] = [];
		const params = message.params ?? {};
		const respond = (result: unknown) =>
			out.push({ jsonrpc: "2.0", id: message.id, result });
		switch (message.method) {
			case "initialize":
				respond({
					capabilities: {
						textDocumentSync: 1,
						completionProvider: { triggerCharacters: ["{", "%", " "] },
						hoverProvider: true,
					},
					serverInfo: { name: "djls-stub", version: `django:${djangoBytes}b` },
				});
				break;
			case "shutdown":
				respond(null);
				break;
			case "djls/syncFiles":
				for (const file of params.files as { uri: string; text: string }[]) {
					this.files.set(file.uri, file.text);
				}
				this.publishAll(out);
				break;
			case "djls/removeFiles":
				for (const uri of params.uris as string[]) this.files.delete(uri);
				this.publishAll(out);
				break;
			case "textDocument/didOpen": {
				const doc = params.textDocument as { uri: string; text: string };
				this.files.set(doc.uri, doc.text);
				this.publishAll(out);
				break;
			}
			case "textDocument/didChange": {
				const uri = (params.textDocument as { uri: string }).uri;
				const changes = params.contentChanges as { text: string }[];
				this.files.set(uri, changes[changes.length - 1].text);
				this.publishAll(out);
				break;
			}
			case "textDocument/completion": {
				const uri = (params.textDocument as { uri: string }).uri;
				const tags = this.knownTags(this.files.get(uri) ?? "");
				respond(
					[...tags].map((label) => ({ label, kind: 14, detail: "djls stub" })),
				);
				break;
			}
			case "textDocument/hover": {
				const uri = (params.textDocument as { uri: string }).uri;
				const pos = params.position as { line: number; character: number };
				const line = (this.files.get(uri) ?? "").split("\n")[pos.line] ?? "";
				const word = wordAt(line, pos.character);
				const library = word ? this.libraryOf(word) : undefined;
				respond(
					word
						? {
								contents: {
									kind: "markdown",
									value: `**{% ${word} %}** (djls stub)\n\nLibrary: \`${library ?? "builtins"}\``,
								},
							}
						: null,
				);
				break;
			}
			default:
				if (message.id !== undefined && message.method) respond(null);
		}
		return JSON.stringify(out);
	}

	private libraries(): Map<string, Set<string>> {
		const libraries = new Map<string, Set<string>>();
		for (const [uri, text] of this.files) {
			const match = uri.match(/\/templatetags\/(\w+)\.py$/);
			if (!match || match[1] === "__init__") continue;
			const tags = new Set<string>();
			for (const m of text.matchAll(
				/@register\.(?:simple_tag|tag|inclusion_tag)[^\n]*\n\s*def\s+(\w+)/g,
			)) {
				tags.add(m[1]);
			}
			libraries.set(match[1], tags);
		}
		return libraries;
	}

	private libraryOf(tag: string): string | undefined {
		for (const [name, tags] of this.libraries()) if (tags.has(tag)) return name;
		return undefined;
	}

	private knownTags(text: string): Set<string> {
		const libraries = this.libraries();
		const tags = new Set(BUILTIN_TAGS);
		for (const m of text.matchAll(/\{%\s*load\s+([\w\s]+?)\s*%\}/g)) {
			for (const name of m[1].split(/\s+/)) {
				for (const tag of libraries.get(name) ?? []) tags.add(tag);
			}
		}
		return tags;
	}

	private publishAll(out: unknown[]): void {
		const libraries = this.libraries();
		for (const [uri, text] of this.files) {
			if (!/\.html$/.test(uri) || uri.includes("/site-packages/")) continue;
			const known = this.knownTags(text);
			const diagnostics: unknown[] = [];
			const lines = text.split("\n");
			lines.forEach((line, lineNo) => {
				for (const m of line.matchAll(/\{%\s*(\w+)([^%]*)%\}/g)) {
					const start = (m.index ?? 0) + m[0].indexOf(m[1]);
					const range = {
						start: { line: lineNo, character: start },
						end: { line: lineNo, character: start + m[1].length },
					};
					if (m[1] === "load") {
						for (const name of m[2].trim().split(/\s+/)) {
							if (name && !libraries.has(name)) {
								diagnostics.push({
									range,
									severity: 1,
									source: "djls-stub",
									message: `'${name}' is not a registered tag library`,
								});
							}
						}
					} else if (!known.has(m[1])) {
						diagnostics.push({
							range,
							severity: 1,
							source: "djls-stub",
							message: `Unknown tag '${m[1]}'`,
						});
					}
				}
			});
			out.push({
				jsonrpc: "2.0",
				method: "textDocument/publishDiagnostics",
				params: { uri, diagnostics },
			});
		}
	}
}

function wordAt(line: string, character: number): string | undefined {
	for (const m of line.matchAll(/\w+/g)) {
		const start = m.index ?? 0;
		if (character >= start && character <= start + m[0].length) return m[0];
	}
	return undefined;
}
