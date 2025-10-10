import * as vscode from "vscode";
import { type LanguageClient, State } from "vscode-languageclient/node";
import { getExtensionConfig, hasDjangoSettings } from "./config";
import { startLanguageServer } from "./server";

let client: LanguageClient | undefined;

function updateStatusBar(
	statusBar: vscode.StatusBarItem,
	languageClient: LanguageClient | undefined,
): void {
	if (!languageClient || languageClient.state !== State.Running) {
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

async function initializeLanguageServer(
	output: vscode.OutputChannel,
): Promise<LanguageClient | undefined> {
	const config = getExtensionConfig();
	const languageClient = await startLanguageServer(output, config);
	return languageClient;
}

function handleStatusBarClick(): void {
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
				vscode.commands.executeCommand(
					"workbench.action.output.show.extension-output-ms-python.vscode-pylance-#1-Django Language Server",
				);
			} else if (selection.label.includes("Restart")) {
				vscode.commands.executeCommand("djls.restart");
			}
		});
}

function registerCommands(
	context: vscode.ExtensionContext,
	getClient: () => LanguageClient | undefined,
	getOutputChannel: () => vscode.OutputChannel,
	getStatusBarItem: () => vscode.StatusBarItem,
	setClient: (c: LanguageClient | undefined) => void,
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
			const newClient = await initializeLanguageServer(getOutputChannel());
			setClient(newClient);
			updateStatusBar(getStatusBarItem(), newClient);
			vscode.window.showInformationMessage("Django Language Server restarted");
		},
	);

	const statusCommand = vscode.commands.registerCommand("djls.status", () => {
		const currentClient = getClient();
		if (currentClient) {
			const state = currentClient.state;
			vscode.window.showInformationMessage(
				`Django Language Server Status: ${state === State.Running ? "Running" : "Stopped"}`,
			);
		} else {
			vscode.window.showWarningMessage(
				"Django Language Server is not initialized",
			);
		}
	});

	const showStatusCommand = vscode.commands.registerCommand(
		"djls.showStatus",
		handleStatusBarClick,
	);

	context.subscriptions.push(restartCommand, statusCommand, showStatusCommand);
}

export async function activate(context: vscode.ExtensionContext) {
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
		() => outputChannel,
		() => statusBarItem,
		(c) => {
			client = c;
		},
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

	client = await initializeLanguageServer(outputChannel);
	updateStatusBar(statusBarItem, client);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
