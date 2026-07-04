import { readTextFile, saveTextFile } from './file-io.js';

// Page bodies live as separate .md files under /pages; the config JSON only
// keeps a `contentRef` pointer to the filename.
export class FilesystemProvider {
  get kind() {
    return 'filesystem';
  }

  async getPageBody(page) {
    if (!page.contentRef) return '';
    return readTextFile(page.contentRef);
  }

  async savePageBody(page, markdown) {
    const filename = page.contentRef ? page.contentRef.split('/').pop() : `${page.slug || page.id}.md`;
    const result = await saveTextFile(filename, markdown);
    page.contentRef = `pages/${result.filename}`;
    delete page.body;
    page.updatedAt = new Date().toISOString();
  }
}
