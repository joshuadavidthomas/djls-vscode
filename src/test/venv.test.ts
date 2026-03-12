import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { findServerInVenv, getVenvBinDir, getVenvServerPath } from "../venv";

const BINARY = process.platform === "win32" ? "djls.exe" : "djls";
const BIN_DIR = process.platform === "win32" ? "Scripts" : "bin";

suite("Venv Test Suite", () => {
	let tempDir: string;

	setup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "djls-venv-test-"));
	});

	teardown(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch {}
	});

	async function createVenv(dir: string): Promise<void> {
		const binDir = path.join(dir, BIN_DIR);
		await fs.mkdir(binDir, { recursive: true });
		await fs.writeFile(path.join(dir, "pyvenv.cfg"), "home = /usr/bin\n");
	}

	async function createBinaryInVenv(dir: string): Promise<string> {
		const binaryPath = path.join(dir, BIN_DIR, BINARY);
		await fs.writeFile(binaryPath, "");
		await fs.chmod(binaryPath, 0o755);
		return binaryPath;
	}

	test("getVenvBinDir returns platform-appropriate bin directory", () => {
		const result = getVenvBinDir("/some/venv");
		const expected =
			process.platform === "win32"
				? path.join("/some/venv", "Scripts")
				: path.join("/some/venv", "bin");
		assert.strictEqual(result, expected);
	});

	test("getVenvServerPath returns full path to binary in venv", () => {
		const result = getVenvServerPath("/some/venv", BINARY);
		const expected = path.join("/some/venv", BIN_DIR, BINARY);
		assert.strictEqual(result, expected);
	});

	test("findServerInVenv finds binary via configured venvPath", async () => {
		const venvDir = path.join(tempDir, "my-venv");
		await createVenv(venvDir);
		const binaryPath = await createBinaryInVenv(venvDir);

		const result = await findServerInVenv(BINARY, undefined, venvDir);

		assert.strictEqual(result, binaryPath);
	});

	test("findServerInVenv finds binary via VIRTUAL_ENV env var", async () => {
		const venvDir = path.join(tempDir, "envvar-venv");
		await createVenv(venvDir);
		const binaryPath = await createBinaryInVenv(venvDir);

		const original = process.env.VIRTUAL_ENV;
		process.env.VIRTUAL_ENV = venvDir;
		try {
			const result = await findServerInVenv(BINARY, undefined, undefined);
			assert.strictEqual(result, binaryPath);
		} finally {
			if (original !== undefined) {
				process.env.VIRTUAL_ENV = original;
			} else {
				delete process.env.VIRTUAL_ENV;
			}
		}
	});

	test("findServerInVenv finds binary in .venv directory", async () => {
		const venvDir = path.join(tempDir, ".venv");
		await createVenv(venvDir);
		const binaryPath = await createBinaryInVenv(venvDir);

		const result = await findServerInVenv(BINARY, tempDir, undefined);

		assert.strictEqual(result, binaryPath);
	});

	test("findServerInVenv finds binary in venv directory", async () => {
		const venvDir = path.join(tempDir, "venv");
		await createVenv(venvDir);
		const binaryPath = await createBinaryInVenv(venvDir);

		const result = await findServerInVenv(BINARY, tempDir, undefined);

		assert.strictEqual(result, binaryPath);
	});

	test("findServerInVenv prefers configured venvPath over auto-detection", async () => {
		// Create both a configured venv and a .venv in the workspace
		const configuredVenv = path.join(tempDir, "custom-venv");
		await createVenv(configuredVenv);
		const configuredBinary = await createBinaryInVenv(configuredVenv);

		const autoVenv = path.join(tempDir, ".venv");
		await createVenv(autoVenv);
		await createBinaryInVenv(autoVenv);

		const result = await findServerInVenv(BINARY, tempDir, configuredVenv);

		assert.strictEqual(result, configuredBinary);
	});

	test("findServerInVenv returns undefined when no venv exists", async () => {
		const result = await findServerInVenv(BINARY, tempDir, undefined);

		assert.strictEqual(result, undefined);
	});

	test("findServerInVenv returns undefined when venv has no binary", async () => {
		const venvDir = path.join(tempDir, ".venv");
		await createVenv(venvDir);
		// Don't create the binary

		const result = await findServerInVenv(BINARY, tempDir, undefined);

		assert.strictEqual(result, undefined);
	});

	test("findServerInVenv returns undefined for directory without pyvenv.cfg", async () => {
		// Create a .venv directory but without pyvenv.cfg (not a real venv)
		const fakeVenv = path.join(tempDir, ".venv");
		const binDir = path.join(fakeVenv, BIN_DIR);
		await fs.mkdir(binDir, { recursive: true });
		await fs.writeFile(path.join(binDir, BINARY), "");

		const result = await findServerInVenv(BINARY, tempDir, undefined);

		assert.strictEqual(result, undefined);
	});

	test("findServerInVenv returns undefined when workspaceRoot is undefined", async () => {
		const result = await findServerInVenv(BINARY, undefined, undefined);

		assert.strictEqual(result, undefined);
	});
});
