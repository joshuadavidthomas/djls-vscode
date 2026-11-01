import * as vscode from "vscode";
import {
	type DocumentSelector,
	LanguageClient,
	type LanguageClientOptions,
	Trace,
} from "vscode-languageclient/browser";
import {
	type ExtensionConfig,
	getExtensionConfig,
	initializationOptions,
} from "../config";
import { PYVENV_CFG, resolveWheel, unpackWheel } from "./pypi";
import {
	isRequirementsFile,
	packageList,
	parsePyprojectDependencies,
	parseRequirementsTxt,
} from "./requirements";
import {
	collectWorkspaceFiles,
	isSkippedPath,
	isWantedFile,
	readFile,
	type SyncedFile,
	WATCH_GLOB,
} from "./workspace";

// Downloaded packages, kept across server restarts in this window.
const packageCache = new Map<string, Promise<Map<string, string>>>();

function documentSelector(): DocumentSelector {
	const schemes = [
		...new Set(
			(vscode.workspace.workspaceFolders ?? []).map(
				(folder) => folder.uri.scheme,
			),
		),
	];
	const filters = [
		{ language: "django-html" },
		{ language: "python" },
		{ pattern: "**/templates/**" },
		{ pattern: "**/*.dj.*" },
		{ pattern: "**/*.djhtml" },
	];
	return schemes.length > 0
		? schemes.flatMap((scheme) =>
				filters.map((filter) => ({ scheme, ...filter })),
			)
		: filters;
}

function serverSettings(config: ExtensionConfig) {
	return {
		...initializationOptions(config),
		// A desktop venv path means nothing here; the server finds the virtual
		// site-packages under the workspace root instead.
		venv_path: undefined,
	};
}

function createClientOptions(config: ExtensionConfig): LanguageClientOptions {
	// No `synchronize.configurationSection`: it would send VS Code's `{ djls: {...} }`
	// section, while djls-wasm takes changed settings in the initializationOptions shape.
	return {
		documentSelector: documentSelector(),
		initializationOptions: serverSettings(config),
	};
}

function workspaceRelativePath(
	folder: vscode.Uri,
	uri: vscode.Uri,
): string | undefined {
	const root = folder.path.endsWith("/") ? folder.path : `${folder.path}/`;
	return uri.scheme === folder.scheme &&
		uri.authority === folder.authority &&
		uri.path.startsWith(root)
		? uri.path.slice(root.length)
		: undefined;
}

function workspaceRequirements(folder: vscode.Uri, files: SyncedFile[]) {
	const requirements: string[] = [];
	for (const file of files) {
		const path = workspaceRelativePath(folder, vscode.Uri.parse(file.uri));
		if (!path) continue;
		if (path.endsWith("pyproject.toml")) {
			requirements.push(...parsePyprojectDependencies(file.text));
		} else if (isRequirementsFile(path)) {
			requirements.push(...parseRequirementsTxt(file.text));
		}
	}
	return requirements;
}

function installPackage(requirement: string) {
	let files = packageCache.get(requirement);
	if (!files) {
		files = resolveWheel(requirement).then(unpackWheel);
		packageCache.set(requirement, files);
		files.catch(() => packageCache.delete(requirement));
	}
	return files;
}

async function installPackages(
	client: LanguageClient,
	folder: vscode.Uri,
	packages: string[],
	output: vscode.OutputChannel,
): Promise<void> {
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Window,
			title: `djls: installing ${packages.length} package(s) from PyPI`,
		},
		async () => {
			const results = await Promise.allSettled(packages.map(installPackage));
			const files: SyncedFile[] = [];
			const failures: string[] = [];
			results.forEach((result, index) => {
				if (result.status === "fulfilled") {
					for (const [path, text] of result.value) {
						files.push({
							uri: vscode.Uri.joinPath(folder, path).toString(),
							text,
						});
					}
					output.appendLine(`Installed ${packages[index]} from PyPI`);
				} else {
					failures.push(packages[index]);
					output.appendLine(
						`Could not install ${packages[index]}: ${result.reason instanceof Error ? result.reason.message : result.reason}`,
					);
				}
			});
			if (files.length > 0) {
				await client.sendNotification("djls/syncFiles", { files });
			}
			if (failures.length > 0) {
				void vscode.window.showWarningMessage(
					`Django Language Server could not install ${failures.join(", ")} from PyPI. See the output for details.`,
				);
			}
		},
	);
}

/**
 * Pushes the workspace to the server, keeps it current with a file watcher, and installs the
 * project's packages into a virtual site-packages.
 */
async function syncWorkspace(
	client: LanguageClient,
	config: ExtensionConfig,
	output: vscode.OutputChannel,
): Promise<vscode.Disposable[]> {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (!folder) return [];

	const { files, venvDirs } = await collectWorkspaceFiles(folder);
	const packages = packageList(
		workspaceRequirements(folder, files),
		config.extraPackages,
	);
	if (packages.length > 0) {
		files.push({
			uri: vscode.Uri.joinPath(folder, PYVENV_CFG.path).toString(),
			text: PYVENV_CFG.content,
		});
	}
	await client.sendNotification("djls/syncFiles", { files });
	output.appendLine(`Synced ${files.length} workspace files to the server`);

	const synced = new Set(files.map((file) => file.uri));
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(folder, WATCH_GLOB),
	);
	const isTracked = (uri: vscode.Uri) => {
		const path = workspaceRelativePath(folder, uri);
		return (
			path !== undefined &&
			isWantedFile(path.slice(path.lastIndexOf("/") + 1)) &&
			!isSkippedPath(path, venvDirs)
		);
	};
	const sync = async (uri: vscode.Uri) => {
		if (!isTracked(uri)) return;
		const file = await readFile(uri);
		if (!file) return;
		synced.add(file.uri);
		await client.sendNotification("djls/syncFiles", { files: [file] });
	};
	const remove = async (uri: vscode.Uri) => {
		// A deleted directory reports only its own URI, so drop everything under it.
		const prefix = `${uri.toString()}/`;
		const uris = [...synced].filter(
			(synced) => synced === uri.toString() || synced.startsWith(prefix),
		);
		if (uris.length === 0) return;
		for (const removed of uris) synced.delete(removed);
		await client.sendNotification("djls/removeFiles", { uris });
	};

	if (packages.length > 0) {
		output.appendLine(`Installing from PyPI: ${packages.join(", ")}`);
		void installPackages(client, folder, packages, output);
	}

	return [
		watcher,
		watcher.onDidCreate(sync),
		watcher.onDidChange(sync),
		watcher.onDidDelete(remove),
	];
}

export async function startLanguageServer(
	output: vscode.OutputChannel,
	config: ExtensionConfig,
	context: vscode.ExtensionContext,
): Promise<LanguageClient | undefined> {
	const dist = vscode.Uri.joinPath(context.extensionUri, "dist", "browser");
	try {
		const worker = new Worker(
			vscode.Uri.joinPath(dist, "worker.js").toString(true),
		);
		// The worker loads the wasm and the Django sources before it serves LSP messages.
		worker.postMessage({
			method: "djls/bootstrap",
			params: {
				wasmUrl: vscode.Uri.joinPath(dist, "djls_wasm_bg.wasm").toString(true),
				djangoUrl: vscode.Uri.joinPath(dist, "django.zip").toString(true),
			},
		});

		const client = new LanguageClient(
			"djls",
			"Django Language Server",
			createClientOptions(config),
			worker,
		);
		// The client never ends the worker itself, and a restart starts a new one. End it once
		// stop() settles: onDidChangeState reports Stopped as soon as stopping begins, before
		// the shutdown request is sent.
		const subscriptions: vscode.Disposable[] = [];
		const stop = client.stop.bind(client);
		client.stop = (timeout) =>
			stop(timeout).finally(() => {
				for (const subscription of subscriptions) subscription.dispose();
				worker.terminate();
			});
		if (config.traceServer !== "off") {
			await client.setTrace(
				config.traceServer === "verbose" ? Trace.Verbose : Trace.Messages,
			);
		}

		await client.start();
		output.appendLine("Django Language Server (wasm) started successfully");

		subscriptions.push(
			...(await syncWorkspace(client, config, output)),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("djls")) {
					void client.sendNotification("workspace/didChangeConfiguration", {
						settings: serverSettings(getExtensionConfig()),
					});
				}
			}),
		);
		return client;
	} catch (error) {
		output.appendLine(`Failed to start Django Language Server: ${error}`);
		vscode.window.showErrorMessage(
			`Failed to start Django Language Server: ${error instanceof Error ? error.message : String(error)}`,
		);
		return undefined;
	}
}
