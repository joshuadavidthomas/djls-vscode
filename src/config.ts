import * as vscode from "vscode";

export interface ExtensionConfig {
	autoInstall: boolean;
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

	// Use platform-appropriate default for the django-language-server binary.
	// On Windows the executable will usually be `djls.exe` while on POSIX
	// systems it is typically `djls`.
	const defaultServer = process.platform === "win32" ? "djls.exe" : "djls";

	return {
		autoInstall: config.get<boolean>("autoInstall", true),
		serverPath: config.get<string>("serverPath", defaultServer),
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
