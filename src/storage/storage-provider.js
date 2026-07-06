import { EmbeddedProvider } from './embedded-provider.js';
import { FilesystemProvider } from './filesystem-provider.js';
import { RdbmsProvider } from './rdbms-provider.js';
import { CONTENT_PROVIDER } from './site-config.js';

export function createContentProvider(kind, options = {}) {
  if (kind === CONTENT_PROVIDER.FILESYSTEM) return new FilesystemProvider();
  if (kind === CONTENT_PROVIDER.RDBMS) return new RdbmsProvider(options);
  return new EmbeddedProvider();
}
