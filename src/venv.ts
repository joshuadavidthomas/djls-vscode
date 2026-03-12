import * as fs from "node:fs/promises";
import * as path from "node:path";

const VENV_DIR_NAMES = [".venv", "venv", "env", ".env"];

export function getVenvBinDir(venvPath: string): string {
	if (process.platform === "win32") {
		return path.join(venvPath, "Scripts");
	}
	return path.join(venvPath, "bin");
}

export function getVenvServerPath(venvPath: string, binary: string): string {
	return path.join(getVenvBinDir(venvPath), binary);
}

async function isVenv(dirPath: string): Promise<boolean> {
	try {
		const pyvenvCfg = path.join(dirPath, "pyvenv.cfg");
		await fs.access(pyvenvCfg);
		return true;
	} catch {
		return false;
	}
}

async function findBinaryInVenv(
	venvPath: string,
	binary: string,
): Promise<string | undefined> {
	if (!(await isVenv(venvPath))) {
		return undefined;
	}

	const serverPath = getVenvServerPath(venvPath, binary);
	try {
		await fs.access(serverPath);
		return serverPath;
	} catch {
		return undefined;
	}
}

export async function findServerInVenv(
	binary: string,
	workspaceRoot: string | undefined,
	configVenvPath: string | undefined,
): Promise<string | undefined> {
	// 1. Check explicitly configured venv path
	if (configVenvPath) {
		const result = await findBinaryInVenv(configVenvPath, binary);
		if (result) {
			return result;
		}
	}

	// 2. Check VIRTUAL_ENV environment variable
	const virtualEnv = process.env.VIRTUAL_ENV;
	if (virtualEnv) {
		const result = await findBinaryInVenv(virtualEnv, binary);
		if (result) {
			return result;
		}
	}

	// 3. Scan common venv directories in the workspace root
	if (workspaceRoot) {
		for (const dirName of VENV_DIR_NAMES) {
			const candidate = path.join(workspaceRoot, dirName);
			const result = await findBinaryInVenv(candidate, binary);
			if (result) {
				return result;
			}
		}
	}

	return undefined;
}
