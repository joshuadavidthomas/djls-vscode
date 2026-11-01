import * as vscode from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";
import {
	type ExtensionConfig,
	getExtensionConfig,
	hasDjangoSettings,
} from "./config";

// Each entry point (desktop and browser) supplies how to start the server; the
// status bar, commands, and configuration handling are shared.
export type StartLanguageServer = (
	output: vscode.OutputChannel,
	config: ExtensionConfig,
	context: vscode.ExtensionContext,
) => Promise<BaseLanguageClient | undefined>;

let client: BaseLanguageClient | undefined;

function updateStatusBar(
	statusBar: vscode.StatusBarItem,
	languageClient: BaseLanguageClient | undefined,
): void {
	if (!languageClient || !languageClient.isRunning()) {
		statusBar.text = "$(error) djls";
		statusBar.backgroundColor = new vscode.ThemeColor(
			"statusBarItem.errorBackground",
		);
		const errorTooltip = new vscode.MarkdownString(
			"Django Language Server failed to start. Click for options.",
		);
		errorTooltip.isTrusted = true;
		statusBar.tooltip = errorTooltip;
		statusBar.show();
	} else if (!hasDjangoSettings()) {
		statusBar.text = "$(warning) djls";
		statusBar.backgroundColor = new vscode.ThemeColor(
			"statusBarItem.warningBackground",
		);
		const warningTooltip = new vscode.MarkdownString(
			"Django Language Server running with limited features.\n\n" +
				"[Configure DJANGO_SETTINGS_MODULE](command:workbench.action.openSettings?%22djls.djangoSettingsModule%22) for full functionality.",
		);
		warningTooltip.isTrusted = true;
		statusBar.tooltip = warningTooltip;
		statusBar.show();
	} else {
		statusBar.hide();
	}
}

function handleStatusBarClick(outputChannel: vscode.OutputChannel): void {
	const items: vscode.QuickPickItem[] = [
		{
			label: "$(gear) Configure Django Settings Module",
			description: "Set DJANGO_SETTINGS_MODULE in settings",
		},
		{
			label: "$(output) View Server Logs",
			description: "Open Django Language Server output",
		},
		{
			label: "$(debug-restart) Restart Server",
			description: "Restart the Django Language Server",
		},
	];

	vscode.window
		.showQuickPick(items, {
			placeHolder: "Django Language Server Options",
		})
		.then((selection) => {
			if (!selection) {
				return;
			}

			if (selection.label.includes("Configure")) {
				vscode.commands.executeCommand(
					"workbench.action.openSettings",
					"djls.djangoSettingsModule",
				);
			} else if (selection.label.includes("View Server Logs")) {
				outputChannel.show();
			} else if (selection.label.includes("Restart")) {
				vscode.commands.executeCommand("djls.restart");
			}
		});
}

function registerCommands(
	context: vscode.ExtensionContext,
	getClient: () => BaseLanguageClient | undefined,
	outputChannel: vscode.OutputChannel,
	statusBarItem: vscode.StatusBarItem,
	setClient: (c: BaseLanguageClient | undefined) => void,
	start: StartLanguageServer,
): void {
	const restartCommand = vscode.commands.registerCommand(
		"djls.restart",
		async () => {
			vscode.window.showInformationMessage(
				"Restarting Django Language Server...",
			);
			const currentClient = getClient();
			if (currentClient) {
				await currentClient.stop();
			}
			const newClient = await start(
				outputChannel,
				getExtensionConfig(),
				context,
			);
			setClient(newClient);
			updateStatusBar(statusBarItem, newClient);
			if (newClient) {
				vscode.window.showInformationMessage(
					"Django Language Server restarted",
				);
			}
		},
	);

	const statusCommand = vscode.commands.registerCommand("djls.status", () => {
		const currentClient = getClient();
		if (currentClient) {
			vscode.window.showInformationMessage(
				`Django Language Server Status: ${currentClient.isRunning() ? "Running" : "Stopped"}`,
			);
		} else {
			vscode.window.showWarningMessage(
				"Django Language Server is not initialized",
			);
		}
	});

	const showStatusCommand = vscode.commands.registerCommand(
		"djls.showStatus",
		() => handleStatusBarClick(outputChannel),
	);

	context.subscriptions.push(restartCommand, statusCommand, showStatusCommand);
}

export async function activateWith(
	context: vscode.ExtensionContext,
	start: StartLanguageServer,
) {
	const outputChannel = vscode.window.createOutputChannel(
		"Django Language Server Client",
	);
	outputChannel.appendLine("Django Language Server extension is now active!");

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100,
	);
	statusBarItem.command = "djls.showStatus";
	context.subscriptions.push(statusBarItem);

	registerCommands(
		context,
		() => client,
		outputChannel,
		statusBarItem,
		(c) => {
			client = c;
		},
		start,
	);

	vscode.workspace.onDidChangeConfiguration(
		(event) => {
			if (event.affectsConfiguration("djls")) {
				updateStatusBar(statusBarItem, client);
			}
		},
		null,
		context.subscriptions,
	);

	client = await start(outputChannel, getExtensionConfig(), context);
	updateStatusBar(statusBarItem, client);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
