import * as vscode from "vscode";
import { SITE_PACKAGES, zipEntries } from "./pypi";

// Definitions can land in files the workspace file system does not have: the virtual
// site-packages the extension installed, and the Django source bundled with djls-wasm, which
// the server reports under `file:///djls-cache/django/<sha>/`. Both are shown as read-only
// documents under this scheme.
export const SOURCE_SCHEME = "djls-source";

const BUNDLED_PREFIX = /^\/djls-cache\/django\/[0-9a-f]+\//;

export class VirtualSources implements vscode.TextDocumentContentProvider {
	private readonly packages = new Map<string, string>();
	private bundled: Promise<Map<string, string>> | undefined;

	constructor(private readonly djangoZip: vscode.Uri) {}

	/** Files from an installed wheel, keyed by their workspace-relative site-packages path. */
	addPackageFiles(files: Map<string, string>): void {
		for (const [path, text] of files) {
			this.packages.set(path.slice(SITE_PACKAGES.length), text);
		}
	}

	/** The virtual URI to show for a server location, or undefined to keep the original. */
	toVirtual(uri: vscode.Uri, root: vscode.Uri): vscode.Uri | undefined {
		if (uri.scheme === "file" && BUNDLED_PREFIX.test(uri.path)) {
			return vscode.Uri.from({
				scheme: SOURCE_SCHEME,
				path: `/django/${uri.path.replace(BUNDLED_PREFIX, "")}`,
			});
		}
		const sitePackages = vscode.Uri.joinPath(root, SITE_PACKAGES).toString();
		const target = uri.toString();
		if (target.startsWith(sitePackages)) {
			return vscode.Uri.from({
				scheme: SOURCE_SCHEME,
				path: `/site-packages/${target.slice(sitePackages.length)}`,
			});
		}
		return undefined;
	}

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const [, area, ...rest] = uri.path.split("/");
		const path = rest.join("/");
		const text =
			area === "django"
				? (await this.loadBundled()).get(path)
				: this.packages.get(path);
		if (text === undefined) throw new Error(`${uri.path} is not available`);
		return text;
	}

	private loadBundled(): Promise<Map<string, string>> {
		this.bundled ??= (async () => {
			const bytes = await vscode.workspace.fs.readFile(this.djangoZip);
			const decoder = new TextDecoder();
			const files = new Map<string, string>();
			for await (const { name, read } of zipEntries(new Uint8Array(bytes))) {
				if (name.endsWith(".py")) files.set(name, decoder.decode(await read()));
			}
			return files;
		})();
		return this.bundled;
	}
}
