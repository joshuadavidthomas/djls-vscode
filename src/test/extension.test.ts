import * as assert from "node:assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
	test("Extension is present", () => {
		const extension = vscode.extensions.getExtension(
			"djls.django-language-server",
		);
		assert.ok(extension);
	});

	test("Extension activates", async () => {
		const extension = vscode.extensions.getExtension(
			"djls.django-language-server",
		);
		assert.ok(extension);

		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	test("djls.restart command is registered", async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes("djls.restart"));
	});

	test("djls.status command is registered", async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes("djls.status"));
	});

	test("djls.showStatus command is registered", async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes("djls.showStatus"));
	});
});
