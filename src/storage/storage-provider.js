import { EmbeddedProvider } from './embedded-provider.js';
import { FilesystemProvider } from './filesystem-provider.js';
import { CONTENT_PROVIDER } from './site-config.js';

export function createContentProvider(kind) {
  return kind === CONTENT_PROVIDER.FILESYSTEM ? new FilesystemProvider() : new EmbeddedProvider();
}
