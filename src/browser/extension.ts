import type * as vscode from "vscode";
import { activateWith } from "../activate";
import { startLanguageServer } from "./server";

export { deactivate } from "../activate";

export function activate(context: vscode.ExtensionContext) {
	return activateWith(context, startLanguageServer);
}
