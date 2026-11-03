import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { context } from "esbuild";

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// The wasm-bindgen `--target web` output of djls-wasm and a stored Django zip, filled by
// `bun run fetch-wasm`. When they are missing, development builds use a stub server so the
// extension still loads; production builds fail.
const WASM_DIR = 'wasm';
const hasWasm = existsSync(`${WASM_DIR}/djls_wasm.js`);

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const djlsWasmPlugin = {
  name: 'djls-wasm',

  setup(build) {
    build.onResolve({ filter: /^djls-wasm$/ }, () => ({
      path: new URL(
        hasWasm ? `${WASM_DIR}/djls_wasm.js` : 'src/browser/stub/djls_wasm.ts',
        import.meta.url,
      ).pathname,
    }));
    build.onEnd(async () => {
      await mkdir('dist/browser', { recursive: true });
      if (hasWasm) {
        await copyFile(`${WASM_DIR}/djls_wasm_bg.wasm`, 'dist/browser/djls_wasm_bg.wasm');
      }
      if (existsSync(`${WASM_DIR}/django.zip`)) {
        await copyFile(`${WASM_DIR}/django.zip`, 'dist/browser/django.zip');
      } else if (!hasWasm) {
        await writeFile('dist/browser/django.zip', new Uint8Array());
      } else {
        throw new Error(`${WASM_DIR}/django.zip is missing`);
      }
    });
  },
};

const shared = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'silent',
};

async function main() {
  if (production && !hasWasm) {
    throw new Error(
      `${WASM_DIR}/djls_wasm.js not found; run \`bun run fetch-wasm\` so the package ships the real server, not the stub`,
    );
  }
  if (!hasWasm) {
    console.warn(`${WASM_DIR}/djls_wasm.js not found; the browser build uses the stub server`);
  }
  const contexts = await Promise.all([
    context({
      ...shared,
      entryPoints: ['src/extension.ts'],
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/extension.js',
      external: ['vscode'],
      plugins: [esbuildProblemMatcherPlugin],
    }),
    // VS Code for the Web loads browser extensions as CommonJS in a web worker.
    context({
      ...shared,
      entryPoints: ['src/browser/extension.ts'],
      format: 'cjs',
      platform: 'browser',
      outfile: 'dist/browser/extension.js',
      external: ['vscode'],
      plugins: [esbuildProblemMatcherPlugin],
    }),
    context({
      ...shared,
      entryPoints: ['src/browser/worker.ts'],
      format: 'iife',
      platform: 'browser',
      outfile: 'dist/browser/worker.js',
      plugins: [esbuildProblemMatcherPlugin, djlsWasmPlugin],
    }),
  ]);
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
