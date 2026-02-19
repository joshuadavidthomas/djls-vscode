import * as vscode from "vscode";

// Platform-appropriate name for the django-language-server binary.
// On Windows the executable will be `djls.exe`, on POSIX systems `djls`.
export const DEFAULT_SERVER_BINARY =
	process.platform === "win32" ? "djls.exe" : "djls";

export interface ExtensionConfig {
	serverPath: string;
	serverArgs: string[];
	djangoSettingsModule: string;
	venvPath: string;
	pythonPath: string[];
	debug: boolean;
	traceServer: string;
}

export function getExtensionConfig(): ExtensionConfig {
	const config = vscode.workspace.getConfiguration("djls");

	return {
		serverPath: config.get<string>("serverPath") || DEFAULT_SERVER_BINARY,
		serverArgs: config.get<string[]>("serverArgs", ["serve"]),
		djangoSettingsModule: config.get<string>("djangoSettingsModule", ""),
		venvPath: config.get<string>("venvPath", ""),
		pythonPath: config.get<string[]>("pythonPath", []),
		debug: config.get<boolean>("debug", false),
		traceServer: config.get<string>("trace.server", "off"),
	};
}

export function hasDjangoSettings(): boolean {
	const config = getExtensionConfig();
	return !!(process.env.DJANGO_SETTINGS_MODULE || config.djangoSettingsModule);
}
