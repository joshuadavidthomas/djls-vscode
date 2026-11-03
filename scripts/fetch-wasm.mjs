// Fills wasm/ with the browser build of django-language-server: the wasm-bindgen output of
// djls-wasm and the Django release the extension registers (BUNDLED_DJANGO in
// src/browser/requirements.ts). By default it downloads the pinned release's wasm asset and
// checks it against the release's checksum. Set DJLS_WASM_DIR to a local `just wasm` output
// directory from a django-language-server checkout to use an unreleased build instead.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DJLS_VERSION = "6.1.2";
// Keep paired with BUNDLED_DJANGO in src/browser/requirements.ts.
const BUNDLED_DJANGO = "5.2";
const OUT = "wasm";

async function download(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Downloading ${url} failed: ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function releasePackage(scratch) {
	const name = `django-language-server-v${DJLS_VERSION}-wasm`;
	const base = `https://github.com/joshuadavidthomas/django-language-server/releases/download/v${DJLS_VERSION}`;
	const archive = await download(`${base}/${name}.tar.gz`);
	const expected = (await download(`${base}/${name}.tar.gz.sha256`))
		.toString()
		.split(/\s+/)[0];
	const actual = createHash("sha256").update(archive).digest("hex");
	if (actual !== expected) {
		throw new Error(
			`SHA-256 mismatch for ${name}.tar.gz: expected ${expected}, got ${actual}`,
		);
	}
	const path = join(scratch, `${name}.tar.gz`);
	await writeFile(path, archive);
	execFileSync("tar", ["xzf", path, "-C", scratch]);
	return join(scratch, name);
}

const scratch = await mkdtemp(join(tmpdir(), "djls-wasm-"));
try {
	const source = process.env.DJLS_WASM_DIR || (await releasePackage(scratch));
	await rm(OUT, { recursive: true, force: true });
	await mkdir(OUT);
	for (const file of ["djls_wasm.js", "djls_wasm_bg.wasm"]) {
		await copyFile(join(source, file), join(OUT, file));
	}
	await copyFile(
		join(source, `django-${BUNDLED_DJANGO}.zip`),
		join(OUT, "django.zip"),
	);
	console.log(
		`wasm/ filled from ${process.env.DJLS_WASM_DIR || `django-language-server v${DJLS_VERSION}`}`,
	);
} finally {
	await rm(scratch, { recursive: true, force: true });
}
