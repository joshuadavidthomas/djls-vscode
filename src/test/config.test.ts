import * as assert from "node:assert";
import * as vscode from "vscode";
import { getExtensionConfig, hasDjangoSettings } from "../config";

suite("Config Test Suite", () => {
	test("getExtensionConfig returns default values", () => {
		const config = getExtensionConfig();

		const expectedServer = process.platform === "win32" ? "djls.exe" : "djls";
		assert.strictEqual(config.serverPath, expectedServer);
		assert.deepStrictEqual(config.serverArgs, ["serve"]);
		assert.strictEqual(config.traceServer, "off");
		assert.strictEqual(config.debug, false);
		assert.deepStrictEqual(config.pythonPath, []);
	});

	test("hasDjangoSettings returns false when not configured", () => {
		const originalEnv = process.env.DJANGO_SETTINGS_MODULE;
		delete process.env.DJANGO_SETTINGS_MODULE;

		const result = hasDjangoSettings();

		assert.strictEqual(result, false);

		if (originalEnv) {
			process.env.DJANGO_SETTINGS_MODULE = originalEnv;
		}
	});

	test("hasDjangoSettings returns true when env var is set", () => {
		const originalEnv = process.env.DJANGO_SETTINGS_MODULE;
		process.env.DJANGO_SETTINGS_MODULE = "myproject.settings";

		const result = hasDjangoSettings();

		assert.strictEqual(result, true);

		if (originalEnv) {
			process.env.DJANGO_SETTINGS_MODULE = originalEnv;
		} else {
			delete process.env.DJANGO_SETTINGS_MODULE;
		}
	});

	test("hasDjangoSettings returns true when config is set", async () => {
		const originalEnv = process.env.DJANGO_SETTINGS_MODULE;
		delete process.env.DJANGO_SETTINGS_MODULE;

		const config = vscode.workspace.getConfiguration("djls");
		await config.update(
			"djangoSettingsModule",
			"myproject.settings",
			vscode.ConfigurationTarget.Global,
		);

		const result = hasDjangoSettings();

		assert.strictEqual(result, true);

		await config.update(
			"djangoSettingsModule",
			"",
			vscode.ConfigurationTarget.Global,
		);
		if (originalEnv) {
			process.env.DJANGO_SETTINGS_MODULE = originalEnv;
		}
	});
});
