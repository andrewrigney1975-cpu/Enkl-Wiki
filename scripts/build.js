import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bumpVersion } from './bump-version.js';
import { formatVersion } from '../src/app/version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

async function build() {
  const { major, minor } = await bumpVersion();
  const version = formatVersion(major, minor);

  // The search worker is bundled as its own self-contained IIFE first; its
  // source text is then embedded into the main bundle as a string constant
  // (__SEARCH_WORKER_SOURCE__) and turned into a Blob-backed Worker at
  // runtime, so the whole app — worker included — still ships as one file.
  const workerResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'search', 'search-worker.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    write: false,
    logLevel: 'warning'
  });
  const workerSource = workerResult.outputFiles[0].text;

  // Bundle JS as a single IIFE (not type="module") so the built file also
  // works when opened directly over file://, where module scripts are
  // blocked by CORS in most browsers.
  const jsResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'app', 'main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    write: false,
    logLevel: 'warning',
    define: { __SEARCH_WORKER_SOURCE__: JSON.stringify(workerSource) }
  });
  const jsText = jsResult.outputFiles[0].text.replaceAll('__APP_VERSION__', version);

  const cssResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'styles', 'main.css')],
    bundle: true,
    minify: true,
    write: false,
    logLevel: 'warning'
  });
  const cssText = cssResult.outputFiles[0].text;

  const template = await readFile(path.join(SRC, 'index.template.html'), 'utf8');
  const html = template
    .replace('<!--STYLES-->', `<style>${cssText}</style>`)
    .replace('<!--SCRIPT-->', `<script>${jsText}</script>`);

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'index.html'), html, 'utf8');

  // Starter content for filesystem-backed content mode.
  await mkdir(path.join(DIST, 'pages'), { recursive: true });
  await mkdir(path.join(DIST, 'uploads'), { recursive: true });
  await cp(path.join(ROOT, 'pages'), path.join(DIST, 'pages'), { recursive: true, force: true }).catch(() => {});
  await cp(path.join(ROOT, 'uploads'), path.join(DIST, 'uploads'), { recursive: true, force: true }).catch(() => {});

  console.log(`Built dist/index.html — Enkl-Wiki v${version}`);
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
