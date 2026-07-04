// Shared low-level file I/O: used by the filesystem content provider (page
// bodies) and, later, by the uploads flow (media assets) and JSON
// import/export. Prefers the File System Access API (a direct, in-place
// write) when the browser supports it in a secure context, and gracefully
// degrades to triggering a browser download otherwise — which is what makes
// this work over file://, from a thumb drive, or in browsers without that
// API (per the spec's "save a document as a download" wording).

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readTextFile(relativePath) {
  const res = await fetch(relativePath);
  if (!res.ok) throw new Error(`Could not read "${relativePath}" (HTTP ${res.status})`);
  return res.text();
}

function extensionOf(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot) : '';
}

// Returns { method: 'filesystem-access' | 'download', filename }.
export async function saveBlob(suggestedName, blob, { mimeType = 'application/octet-stream', description = 'File' } = {}) {
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [mimeType]: [extensionOf(suggestedName) || '.dat'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: 'filesystem-access', filename: handle.name };
    } catch (err) {
      if (err && err.name === 'AbortError') throw err; // user cancelled the save
      // Any other failure (e.g. unsupported in this context) — fall back to download.
    }
  }
  triggerDownload(suggestedName, blob);
  return { method: 'download', filename: suggestedName };
}

export function saveTextFile(suggestedName, text, options = {}) {
  const opts = { mimeType: 'text/markdown', description: 'Markdown file', ...options };
  return saveBlob(suggestedName, new Blob([text], { type: opts.mimeType }), opts);
}
