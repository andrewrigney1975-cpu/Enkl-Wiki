import { triggerDownload } from './file-io.js';
import { slugify } from '../content/page-model.js';
import { isValidConfigShape } from './site-config.js';

export function exportConfig(config) {
  const text = JSON.stringify(config, null, 2);
  const name = `${slugify(config?.site?.title) || 'enkl-wiki'}-export.json`;
  triggerDownload(name, new Blob([text], { type: 'application/json' }));
  return name;
}

export async function importConfigFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isValidConfigShape(parsed)) {
    throw new Error('That file does not look like an Enkl-Wiki export.');
  }
  return parsed;
}
