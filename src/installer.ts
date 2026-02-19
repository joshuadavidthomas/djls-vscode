import { exec } from "node:child_process";
import * as fsPromises from "node:fs/promises";
import * as https from "node:https";
import * as path from "node:path";
import { promisify } from "node:util";
import type * as vscode from "vscode";

const execAsync = promisify(exec);

const GITHUB_REPO = "joshuadavidthomas/django-language-server";
const PACKAGE_NAME = "django-language-server";
const EXECUTABLE_NAME = "djls";

interface GithubRelease {
	tag_name: string;
	assets: GithubAsset[];
}

interface GithubAsset {
	name: string;
	browser_download_url: string;
}

interface PlatformInfo {
	os: string;
	arch: string;
	ext: string;
}

function getPlatformInfo(): PlatformInfo | undefined {
	let os: string;
	switch (process.platform) {
		case "darwin":
			os = "darwin";
			break;
		case "linux":
			os = "linux";
			break;
		case "win32":
			os = "windows";
			break;
		default:
			return undefined;
	}

	let arch: string;
	switch (process.arch) {
		case "arm64":
			arch = "arm64";
			break;
		case "x64":
			arch = "x64";
			break;
		default:
			return undefined;
	}

	const ext = os === "windows" ? "zip" : "tar.gz";
	return { os, arch, ext };
}

function httpsGet(url: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const options = {
			headers: {
				"User-Agent": "djls-vscode",
				Accept: "application/octet-stream",
			},
		};

		const makeRequest = (requestUrl: string, redirectCount: number) => {
			if (redirectCount > 10) {
				reject(new Error("Too many redirects"));
				return;
			}

			https
				.get(requestUrl, options, (res) => {
					if (
						(res.statusCode === 301 ||
							res.statusCode === 302 ||
							res.statusCode === 307) &&
						res.headers.location
					) {
						makeRequest(res.headers.location, redirectCount + 1);
						return;
					}

					if (res.statusCode !== 200) {
						reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
						return;
					}

					const chunks: Buffer[] = [];
					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("end", () => resolve(Buffer.concat(chunks)));
					res.on("error", reject);
				})
				.on("error", reject);
		};

		makeRequest(url, 0);
	});
}

async function fetchLatestRelease(): Promise<GithubRelease> {
	const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

	const data = await new Promise<string>((resolve, reject) => {
		https
			.get(
				url,
				{
					headers: {
						"User-Agent": "djls-vscode",
						Accept: "application/vnd.github.v3+json",
					},
				},
				(res) => {
					if (res.statusCode !== 200) {
						reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
						return;
					}

					let body = "";
					res.on("data", (chunk: string) => {
						body += chunk;
					});
					res.on("end", () => resolve(body));
					res.on("error", reject);
				},
			)
			.on("error", reject);
	});

	return JSON.parse(data) as GithubRelease;
}

export function getInstalledServerPath(storagePath: string): string {
	const execName =
		process.platform === "win32" ? `${EXECUTABLE_NAME}.exe` : EXECUTABLE_NAME;
	return path.join(storagePath, "server", execName);
}

export async function checkInstalledServer(
	storagePath: string,
): Promise<boolean> {
	try {
		await fsPromises.access(getInstalledServerPath(storagePath));
		return true;
	} catch {
		return false;
	}
}

export async function installServer(
	storagePath: string,
	outputChannel: vscode.OutputChannel,
): Promise<string> {
	const platform = getPlatformInfo();
	if (!platform) {
		throw new Error(
			`Unsupported platform: ${process.platform} ${process.arch}`,
		);
	}

	outputChannel.appendLine("Fetching latest release information...");
	const release = await fetchLatestRelease();

	const version = release.tag_name;
	const baseName = `${PACKAGE_NAME}-${version}-${platform.os}-${platform.arch}`;
	const assetName = `${baseName}.${platform.ext}`;

	const asset = release.assets.find((a) => a.name === assetName);
	if (!asset) {
		const available = release.assets.map((a) => a.name).join(", ");
		throw new Error(
			`No release asset found for ${assetName}. Available assets: ${available}`,
		);
	}

	const serverDir = path.join(storagePath, "server");
	await fsPromises.mkdir(serverDir, { recursive: true });

	const archivePath = path.join(storagePath, assetName);
	outputChannel.appendLine(`Downloading ${assetName}...`);

	const data = await httpsGet(asset.browser_download_url);
	await fsPromises.writeFile(archivePath, data);

	outputChannel.appendLine("Extracting...");
	await execAsync(`tar -xf "${archivePath}" -C "${storagePath}"`);

	const extractedDir = path.join(storagePath, baseName);
	const execName =
		process.platform === "win32" ? `${EXECUTABLE_NAME}.exe` : EXECUTABLE_NAME;
	const extractedBinary = path.join(extractedDir, execName);
	const finalBinary = getInstalledServerPath(storagePath);

	await fsPromises.rename(extractedBinary, finalBinary);

	if (process.platform !== "win32") {
		await fsPromises.chmod(finalBinary, 0o755);
	}

	try {
		await fsPromises.rm(archivePath);
		await fsPromises.rm(extractedDir, { recursive: true });
	} catch {
		// Cleanup failures are non-fatal
	}

	outputChannel.appendLine(
		`Django Language Server ${version} installed successfully`,
	);
	return finalBinary;
}
