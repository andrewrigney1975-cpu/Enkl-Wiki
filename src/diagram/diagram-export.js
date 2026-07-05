import { SHAPE_TYPES } from './diagram-shapes.js';

// Standalone SVG files can't rely on the app's Google Font <link> having
// loaded, so labels explicitly request the same font stack as the rest of
// the UI (see --ek-font in theme.css) with system-font fallbacks.
const LABEL_FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function shapeCenter(shape) {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

// Produces a standalone, dependency-free SVG document string for the given
// { shapes, connectors } diagram data — used both for file export to
// /uploads and for jsdom-free assertions in tests.
export function serializeDiagramToSvg(data, { width = 900, height = 560 } = {}) {
  const connectorsMarkup = data.connectors.map((conn) => {
    const from = data.shapes.find((s) => s.id === conn.fromId);
    const to = data.shapes.find((s) => s.id === conn.toId);
    if (!from || !to) return '';
    const a = shapeCenter(from);
    const b = shapeCenter(to);
    const line = conn.style === 'curved'
      ? `<path d="M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 - 40} ${b.x},${b.y}" fill="none" stroke="#6b778c" stroke-width="1.5" marker-end="url(#ekArrow)"/>`
      : `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6b778c" stroke-width="1.5" marker-end="url(#ekArrow)"/>`;
    const label = conn.label
      ? `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 6}" text-anchor="middle" font-family="${LABEL_FONT_FAMILY}" font-size="11" fill="#172b4d">${escapeXml(conn.label)}</text>`
      : '';
    return line + label;
  }).join('');

  const shapesMarkup = data.shapes.map((shape) => {
    const def = SHAPE_TYPES[shape.type];
    const body = def ? def.body(shape.w, shape.h) : '';
    return `<g transform="translate(${shape.x},${shape.y})">`
      + `<g fill="#f1f2f4" stroke="#333333" stroke-width="1.5">${body}</g>`
      + `<text x="${shape.w / 2}" y="${shape.h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${LABEL_FONT_FAMILY}" font-size="12" fill="#172b4d">${escapeXml(shape.label)}</text>`
      + '</g>';
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + '<defs><marker id="ekArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse">'
    + '<path d="M0,0 L10,5 L0,10 z" fill="#6b778c"/></marker></defs>'
    + `<rect width="${width}" height="${height}" fill="#ffffff"/>`
    + connectorsMarkup + shapesMarkup
    + '</svg>';
}
