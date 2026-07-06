export const CONTENT_PROVIDER = { EMBEDDED: 'embedded', FILESYSTEM: 'filesystem', RDBMS: 'rdbms' };

export function createDefaultConfig() {
  return {
    site: { title: 'Enkl-Wiki', description: '' },
    settings: {
      contentBackingProvider: CONTENT_PROVIDER.EMBEDDED,
      // Populated on first run by the auth module (default credential "foobar").
      credentialSalt: null,
      credentialHash: null
    },
    tags: [],
    pages: [],
    // Metadata only — the files themselves live in /uploads on disk (or as
    // a browser download when saved without File System Access support).
    uploads: []
  };
}

export function isValidConfigShape(config) {
  return Boolean(config
    && typeof config === 'object'
    && config.site && typeof config.site.title === 'string'
    && config.settings && typeof config.settings.contentBackingProvider === 'string'
    && Array.isArray(config.tags)
    && Array.isArray(config.pages));
}
