import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bumpVersion } from './bump-version.js';
import { formatVersion } from '../src/app/version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// The HTML parser's "script data state" treats a raw `<!--` or `</script`
// appearing anywhere in an inline <script>'s text specially (a legacy
// mechanism for hiding scripts from pre-JS browsers) — it does not
// understand JS syntax, so it can't tell these apart from a string, regex,
// or comment that merely happens to contain that text (e.g. Prism's markup
// grammar has a literal `/<!--.../ ` regex for matching HTML comments).
// Splitting the sequence with a backslash is semantically a no-op wherever
// it can legally appear (inside a string/regex it's just an escaped
// character; elsewhere `</script`/`<!--` can't occur as meaningful adjacent
// JS tokens), and stops the HTML tokenizer from ever recognizing it.
function escapeForInlineScript(code) {
  return code
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
}

// Bundles the app + search worker + CSS and assembles the final single-file
// HTML string. Pure — no file writes, no version bumping — so tests can
// exercise the exact production build pipeline without mutating version.json
// or dist/ on every run.
export async function buildHtml(version) {
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
  const jsText = escapeForInlineScript(jsResult.outputFiles[0].text.replaceAll('__APP_VERSION__', version));

  const cssResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'styles', 'main.css')],
    bundle: true,
    minify: true,
    write: false,
    logLevel: 'warning'
  });
  const cssText = cssResult.outputFiles[0].text;

  const template = await readFile(path.join(SRC, 'index.template.html'), 'utf8');
  // Replacer *functions* here, not plain strings — String.replace() treats
  // literal `$`-sequences in a plain replacement string as special patterns
  // (`` $` ``, `$'`, `$&`, ...) regardless of whether the search term is a
  // string or regex, and Prism's bash grammar contains literal `` $` `` /
  // `$'` text (matching bash's backtick/ANSI-C-quote syntax) that would
  // otherwise get misinterpreted and corrupt the output. A function's
  // return value is always inserted verbatim.
  return template
    .replace('<!--STYLES-->', () => `<style>${cssText}</style>`)
    .replace('<!--SCRIPT-->', () => `<script>${jsText}</script>`);
}

async function build() {
  const { major, minor } = await bumpVersion();
  const version = formatVersion(major, minor);
  const html = await buildHtml(version);

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'index.html'), html, 'utf8');

  // Starter content for filesystem-backed content mode.
  await mkdir(path.join(DIST, 'pages'), { recursive: true });
  await mkdir(path.join(DIST, 'uploads'), { recursive: true });
  await cp(path.join(ROOT, 'pages'), path.join(DIST, 'pages'), { recursive: true, force: true }).catch(() => {});
  await cp(path.join(ROOT, 'uploads'), path.join(DIST, 'uploads'), { recursive: true, force: true }).catch(() => {});

  console.log(`Built dist/index.html — Enkl-Wiki v${version}`);
}

// Only run the CLI build when this file is executed directly, not when
// imported (e.g. by tests importing buildHtml).
const isMain = import.meta.url === `file://${process.argv[1]}`
  || import.meta.url === `file:///${(process.argv[1] || '').replace(/\\/g, '/')}`;

if (isMain) {
  build().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
