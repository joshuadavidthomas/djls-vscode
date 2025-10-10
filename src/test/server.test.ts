import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { checkServerAvailable, findDjangoProjectRoot } from "../server";

suite("Server Test Suite", () => {
	let tempDir: string;

	setup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "djls-test-"));
	});

	teardown(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	test("findDjangoProjectRoot finds manage.py in current directory", async () => {
		const managePyPath = path.join(tempDir, "manage.py");
		await fs.writeFile(managePyPath, "#!/usr/bin/env python");

		const result = await findDjangoProjectRoot(tempDir);

		assert.strictEqual(result, tempDir);
	});

	test("findDjangoProjectRoot finds manage.py in parent directory", async () => {
		const subDir = path.join(tempDir, "app", "subdir");
		await fs.mkdir(subDir, { recursive: true });

		const managePyPath = path.join(tempDir, "manage.py");
		await fs.writeFile(managePyPath, "#!/usr/bin/env python");

		const result = await findDjangoProjectRoot(subDir);

		assert.strictEqual(result, tempDir);
	});

	test("findDjangoProjectRoot returns undefined when manage.py not found", async () => {
		const subDir = path.join(tempDir, "no-django");
		await fs.mkdir(subDir, { recursive: true });

		const result = await findDjangoProjectRoot(subDir);

		assert.strictEqual(result, undefined);
	});

	test("findDjangoProjectRoot returns undefined when startPath is undefined", async () => {
		const result = await findDjangoProjectRoot(undefined);

		assert.strictEqual(result, undefined);
	});

	test("checkServerAvailable returns false for non-existent command", async () => {
		const result = await checkServerAvailable("nonexistent-command-12345");

		assert.strictEqual(result, false);
	});

	test("checkServerAvailable returns true for existing command", async () => {
		const result = await checkServerAvailable("node");

		assert.strictEqual(result, true);
	});
});
