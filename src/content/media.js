const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a'];
const VIDEO_EXT = ['mp4', 'webm', 'ogv'];

export function extensionOf(url) {
  const clean = String(url || '').split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

export function mediaKind(url) {
  const ext = extensionOf(url);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return 'image';
}

// alt/url/title are expected to already be HTML-escaped/sanitized by the caller.
export function renderMediaEmbed(alt, url, title) {
  const kind = mediaKind(url);
  const titleAttr = title ? ` title="${title}"` : '';
  if (kind === 'audio') {
    return `<audio controls src="${url}"${titleAttr}>${alt}</audio>`;
  }
  if (kind === 'video') {
    return `<video controls src="${url}"${titleAttr}></video>`;
  }
  return `<img src="${url}" alt="${alt}"${titleAttr} loading="lazy">`;
}
