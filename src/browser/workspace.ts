import * as vscode from "vscode";

// djls in the browser cannot read the file system, so the extension host reads the files it
// needs and pushes them to the server.

export interface SyncedFile {
	uri: string;
	text: string;
}

const SKIPPED_DIRS = new Set([
	"node_modules",
	".git",
	"__pycache__",
	".venv",
	"venv",
	"env",
	".env",
]);
const CONFIG_FILES = new Set(["pyproject.toml", "djls.toml", ".djls.toml"]);
// Larger files are generated or vendored; skip them rather than stall the server.
const MAX_FILE_BYTES = 1024 * 1024;

export const WATCH_GLOB = "**/*.{py,html,txt,toml}";

export function isWantedFile(name: string): boolean {
	return /\.(py|html|txt)$/.test(name) || CONFIG_FILES.has(name);
}

/** Whether a path inside a workspace folder is under a skipped or virtualenv directory. */
export function isSkippedPath(
	relativePath: string,
	venvDirs: ReadonlySet<string>,
): boolean {
	const segments = relativePath.split("/");
	return segments.some(
		(segment, index) =>
			index < segments.length - 1 &&
			(SKIPPED_DIRS.has(segment) ||
				venvDirs.has(segments.slice(0, index + 1).join("/"))),
	);
}

export async function readFile(
	uri: vscode.Uri,
): Promise<SyncedFile | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > MAX_FILE_BYTES) return undefined;
		return { uri: uri.toString(), text: new TextDecoder().decode(bytes) };
	} catch {
		return undefined;
	}
}

/**
 * Reads every file djls needs from a workspace folder. Also returns the relative paths of
 * virtualenvs found (directories holding a pyvenv.cfg) so the watcher can skip them too.
 */
export async function collectWorkspaceFiles(folder: vscode.Uri): Promise<{
	files: SyncedFile[];
	venvDirs: Set<string>;
}> {
	const files: SyncedFile[] = [];
	const venvDirs = new Set<string>();

	async function walk(relativeDir: string): Promise<void> {
		const dir = relativeDir ? vscode.Uri.joinPath(folder, relativeDir) : folder;
		let entries: [string, vscode.FileType][];
		try {
			entries = await vscode.workspace.fs.readDirectory(dir);
		} catch {
			return;
		}
		if (relativeDir && entries.some(([name]) => name === "pyvenv.cfg")) {
			venvDirs.add(relativeDir);
			return;
		}
		const pending: Promise<unknown>[] = [];
		for (const [name, type] of entries) {
			const relative = relativeDir ? `${relativeDir}/${name}` : name;
			if (type & vscode.FileType.Directory) {
				if (!SKIPPED_DIRS.has(name)) pending.push(walk(relative));
			} else if (type & vscode.FileType.File && isWantedFile(name)) {
				pending.push(
					readFile(vscode.Uri.joinPath(folder, relative)).then((file) => {
						if (file) files.push(file);
					}),
				);
			}
		}
		await Promise.all(pending);
	}

	await walk("");
	return { files, venvDirs };
}
