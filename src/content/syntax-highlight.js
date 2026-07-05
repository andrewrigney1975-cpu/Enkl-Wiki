// Prism's core tokenizer works on plain strings (no DOM needed), so it runs
// identically when rendering a page for reading, inside the WYSIWYG editor's
// preview, and in the standalone HTML export. We import prism-core directly
// (rather than the full `prismjs` package entry) because that full bundle
// also concatenates the file-highlight plugin, which assumes a complete
// browser-global environment (it references a bare `Element`) and throws in
// Node/jsdom test contexts that don't expose one — we never use that plugin
// anyway, since we only call Prism.highlight() programmatically.
import Prism from 'prismjs/components/prism-core.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js'; // requires clike
import 'prismjs/components/prism-typescript.js'; // requires javascript
import 'prismjs/components/prism-jsx.js'; // requires markup, javascript
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js'; // requires markup

// Common short/alternate names people actually type after ``` in a fence.
const LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python'
};

// Offered to editors when picking a language explicitly (e.g. a future
// toolbar language picker) — value must resolve to a loaded Prism grammar.
export const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'markup', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' }
];

// Returns highlighted (already HTML-escaped) markup, or null if `lang` isn't
// recognized — callers should fall back to plain escaped text in that case.
export function highlightCode(code, lang) {
  const key = String(lang || '').trim().toLowerCase();
  const normalized = LANGUAGE_ALIASES[key] || key;
  const grammar = normalized && Prism.languages[normalized];
  if (!grammar) return null;
  return Prism.highlight(code, grammar, normalized);
}
