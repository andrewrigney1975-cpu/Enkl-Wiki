// Page bodies are fetched lazily over HTTP, exactly like FilesystemProvider
// does with local .md files — GET/PUT /api/pages/{id}/body. Everything else
// (hierarchy, tags, uploads, site settings) is handled by the semantic
// mutation functions in app/state.js, which talk to the rest of the API.
export class RdbmsProvider {
  constructor({ apiBaseUrl = '', getToken = () => null } = {}) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    this.getToken = getToken;
  }

  get kind() {
    return 'rdbms';
  }

  async getPageBody(page) {
    const res = await fetch(`${this.apiBaseUrl}/api/pages/${page.id}/body`);
    if (!res.ok) throw new Error(`Could not load page body (HTTP ${res.status})`);
    const data = await res.json();
    return data.body;
  }

  async savePageBody(page, markdown) {
    const token = this.getToken();
    const res = await fetch(`${this.apiBaseUrl}/api/pages/${page.id}/body`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ body: markdown })
    });
    if (!res.ok) throw new Error(`Could not save page body (HTTP ${res.status})`);
    page.updatedAt = new Date().toISOString();
  }
}
