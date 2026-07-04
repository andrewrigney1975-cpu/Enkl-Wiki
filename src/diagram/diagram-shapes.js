// Shape outline generators used by both the interactive editor and the
// standalone SVG export — each returns the inner markup (no fill/stroke, the
// caller decides those) for a shape of the given width/height.
export const SHAPE_TYPES = {
  process: {
    label: 'Process',
    w: 120,
    h: 56,
    body: (w, h) => `<rect x="0" y="0" width="${w}" height="${h}" rx="4"/>`
  },
  decision: {
    label: 'Decision',
    w: 120,
    h: 76,
    body: (w, h) => `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}"/>`
  },
  terminal: {
    label: 'Terminal',
    w: 120,
    h: 56,
    body: (w, h) => `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}"/>`
  },
  io: {
    label: 'Input/Output',
    w: 130,
    h: 56,
    body: (w, h) => `<polygon points="20,0 ${w},0 ${w - 20},${h} 0,${h}"/>`
  },
  user: {
    label: 'User',
    w: 70,
    h: 84,
    body: (w, h) => `<circle cx="${w / 2}" cy="18" r="16"/><path d="M6,${h} v-16 a${w / 2 - 6},20 0 0 1 ${w - 12},0 v16 z"/>`
  },
  page: {
    label: 'Page',
    w: 90,
    h: 100,
    body: (w, h) => `<path d="M8,0 H${w - 22} L${w - 8},18 V${h} H8 Z"/><path d="M${w - 22},0 V18 H${w - 8}" fill="none"/>`
  },
  database: {
    label: 'Database',
    w: 110,
    h: 90,
    body: (w, h) => `<path d="M0,15 A${w / 2},15 0 0 1 ${w},15 V${h - 15} A${w / 2},15 0 0 1 0,${h - 15} Z"/><ellipse cx="${w / 2}" cy="15" rx="${w / 2}" ry="15"/>`
  },
  api: {
    label: 'API',
    w: 120,
    h: 60,
    body: (w, h) => `<polygon points="20,0 ${w - 20},0 ${w},${h / 2} ${w - 20},${h} 20,${h} 0,${h / 2}"/>`
  },
  code: {
    label: 'Code',
    w: 110,
    h: 56,
    body: (w, h) => `<rect x="0" y="0" width="${w}" height="${h}" rx="4"/>`
  }
};
