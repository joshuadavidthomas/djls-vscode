import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import {
	LanguageClient,
	type LanguageClientOptions,
	type ServerOptions,
} from "vscode-languageclient/node";
import type { ExtensionConfig } from "./config";

export async function checkServerAvailable(command: string): Promise<boolean> {
	try {
		await promisify(exec)(`${command} --version`);
		return true;
	} catch {
		return false;
	}
}

export async function findDjangoProjectRoot(
	startPath: string | undefined,
): Promise<string | undefined> {
	if (!startPath) {
		return undefined;
	}

	let currentDir = startPath;
	const root = path.parse(currentDir).root;

	while (currentDir !== root) {
		const managePyPath = path.join(currentDir, "manage.py");

		try {
			await fs.access(managePyPath);
			return currentDir;
		} catch {
			currentDir = path.dirname(currentDir);
		}
	}

	return undefined;
}

async function createServerOptions(
	config: ExtensionConfig,
): Promise<ServerOptions> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const djangoRoot =
		(await findDjangoProjectRoot(workspaceRoot)) || workspaceRoot;

	return {
		command: config.serverPath,
		args: config.serverArgs,
		options: {
			cwd: djangoRoot,
			env: {
				...process.env,
			},
		},
	};
}

function createClientOptions(config: ExtensionConfig): LanguageClientOptions {
	return {
		documentSelector: [
			{ scheme: "file", language: "django-html" },
			{ scheme: "file", language: "python" },
			{ scheme: "file", pattern: "**/templates/**" },
			{ scheme: "file", pattern: "**/*.dj.*" },
			{ scheme: "file", pattern: "**/*.djhtml" },
		],
		synchronize: {
			configurationSection: "djls",
			fileEvents: [
				vscode.workspace.createFileSystemWatcher("**/*.py"),
				vscode.workspace.createFileSystemWatcher("**/templates/**"),
				vscode.workspace.createFileSystemWatcher("**/*.dj.*"),
				vscode.workspace.createFileSystemWatcher("**/*.djhtml"),
			],
		},
		initializationOptions: {
			django_settings_module: config.djangoSettingsModule || undefined,
			venv_path: config.venvPath || undefined,
			python_path: config.pythonPath.length > 0 ? config.pythonPath : undefined,
			debug: config.debug,
		},
	};
}

export async function startLanguageServer(
	outputChannel: vscode.OutputChannel,
	config: ExtensionConfig,
): Promise<LanguageClient | undefined> {
	const isAvailable = await checkServerAvailable(config.serverPath);
	if (!isAvailable) {
		const message = `Django Language Server (djls) not found.

Install via:
  • Releases: https://github.com/joshuadavidthomas/django-language-server/releases
  • pip: pip install django-language-server
  • uv: uv tool install django-language-server

Or configure a custom path in settings.`;
		outputChannel.appendLine(message);
		vscode.window
			.showErrorMessage(
				"Django Language Server (djls) not found.",
				"Installation Guide",
				"Open Settings",
			)
			.then((selection) => {
				if (selection === "Installation Guide") {
					vscode.env.openExternal(
						vscode.Uri.parse(
							"https://github.com/joshuadavidthomas/django-language-server/releases",
						),
					);
				} else if (selection === "Open Settings") {
					vscode.commands.executeCommand(
						"workbench.action.openSettings",
						"djls.serverPath",
					);
				}
			});
		return undefined;
	}

	const serverOptions = await createServerOptions(config);
	const clientOptions = createClientOptions(config);

	const client = new LanguageClient(
		"djls",
		"Django Language Server",
		serverOptions,
		clientOptions,
	);

	if (config.traceServer !== "off") {
		client.setTrace(config.traceServer === "verbose" ? 2 : 1);
	}

	try {
		await client.start();
		outputChannel.appendLine("Django Language Server started successfully");
		return client;
	} catch (error) {
		outputChannel.appendLine(
			`Failed to start Django Language Server: ${error}`,
		);
		vscode.window.showErrorMessage(
			`Failed to start Django Language Server: ${error instanceof Error ? error.message : String(error)}`,
		);
		return undefined;
	}
}
