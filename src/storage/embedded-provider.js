// Page bodies live directly in the site config JSON (persisted to
// localStorage by the caller after each mutation).
export class EmbeddedProvider {
  get kind() {
    return 'embedded';
  }

  async getPageBody(page) {
    return page.body ?? '';
  }

  async savePageBody(page, markdown) {
    page.body = markdown;
    delete page.contentRef;
    page.updatedAt = new Date().toISOString();
  }
}
