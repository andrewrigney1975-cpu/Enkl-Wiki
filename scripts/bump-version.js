import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VERSION_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'version.json');

export async function bumpVersion() {
  const raw = await readFile(VERSION_FILE, 'utf8');
  const current = JSON.parse(raw);
  const next = { major: current.major, minor: current.minor + 1 };
  await writeFile(VERSION_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

// Allow `node scripts/bump-version.js` standalone as well as being imported by build.js.
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const next = await bumpVersion();
  console.log(`Bumped version to ${next.major}.${next.minor}`);
}
