// Hand-rolled WYSIWYG Markdown editor. The WYSIWYG surface is a
// contenteditable div (using the browser's own execCommand primitives for
// bold/italic/list/etc. editing) that is round-tripped to/from Markdown via
// renderMarkdown() and htmlToMarkdown() below — there is no bundled rich-text
// library. A "Raw" toggle exposes the underlying Markdown directly in a
// textarea, per the spec's requirement to let editors see/edit the source.
import { renderMarkdown } from './markdown.js';
import { iconMarkup } from '../ui/icons.js';

export function htmlToMarkdown(root) {
  function walkChildren(node) {
    return [...node.childNodes].map(walk).join('');
  }

  function walk(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();
    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const level = Number(tag[1]);
        return `${'#'.repeat(level)} ${walkChildren(node).trim()}\n\n`;
      }
      case 'p': case 'div':
        return `${walkChildren(node).trim()}\n\n`;
      case 'strong': case 'b':
        return `**${walkChildren(node)}**`;
      case 'em': case 'i':
        return `*${walkChildren(node)}*`;
      case 'code':
        return node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre'
          ? walkChildren(node)
          : `\`${walkChildren(node)}\``;
      case 'pre': {
        const codeEl = node.querySelector('code');
        const langMatch = codeEl && codeEl.className.match(/language-(\S+)/);
        const lang = langMatch ? langMatch[1] : '';
        const text = (codeEl || node).textContent;
        return '```' + lang + '\n' + text + '\n```\n\n';
      }
      case 'a':
        return `[${walkChildren(node)}](${node.getAttribute('href') || ''})`;
      case 'img':
        return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
      case 'audio':
      case 'video':
        return `![${node.getAttribute('title') || ''}](${node.getAttribute('src') || ''})`;
      case 'ul':
        return [...node.children].map((li) => `- ${walk(li).trim()}`).join('\n') + '\n\n';
      case 'ol':
        return [...node.children].map((li, idx) => `${idx + 1}. ${walk(li).trim()}`).join('\n') + '\n\n';
      case 'li':
        return walkChildren(node);
      case 'blockquote':
        return walkChildren(node).trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
      case 'hr':
        return '---\n\n';
      case 'br':
        return '\n';
      default:
        return walkChildren(node);
    }
  }

  const text = walk(root).replace(/\n{3,}/g, '\n\n').trim();
  return text ? text + '\n' : '';
}

const TOOLBAR_ACTIONS = [
  { icon: 'bold', title: 'Bold', command: 'bold' },
  { icon: 'italic', title: 'Italic', command: 'italic' },
  { icon: 'quote', title: 'Blockquote', command: 'formatBlock', value: 'blockquote' },
  { icon: 'listUl', title: 'Bulleted list', command: 'insertUnorderedList' },
  { icon: 'listOl', title: 'Numbered list', command: 'insertOrderedList' },
  { icon: 'code', title: 'Code block', command: 'formatBlock', value: 'pre' }
];

export function createMarkdownEditor({ initialValue = '' } = {}) {
  const root = document.createElement('div');
  root.className = 'ek-md-editor';

  const toolbar = document.createElement('div');
  toolbar.className = 'ek-md-toolbar';

  const wysiwyg = document.createElement('div');
  wysiwyg.className = 'ek-md-wysiwyg';
  wysiwyg.contentEditable = 'true';
  wysiwyg.innerHTML = renderMarkdown(initialValue);

  const raw = document.createElement('textarea');
  raw.className = 'ek-md-raw ek-hidden';
  raw.value = initialValue;

  let mode = 'wysiwyg';

  for (const action of TOOLBAR_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ek-md-toolbar-btn';
    btn.title = action.title;
    btn.innerHTML = iconMarkup(action.icon, 15);
    btn.addEventListener('click', () => {
      wysiwyg.focus();
      if (typeof document.execCommand === 'function') {
        try {
          document.execCommand(action.command, false, action.value);
        } catch {
          /* execCommand unsupported in this environment */
        }
      }
    });
    toolbar.appendChild(btn);
  }

  const modeToggle = document.createElement('button');
  modeToggle.type = 'button';
  modeToggle.className = 'ek-md-toolbar-btn ek-md-mode-toggle';
  modeToggle.textContent = 'View Markdown';
  modeToggle.addEventListener('click', () => {
    if (mode === 'wysiwyg') {
      raw.value = htmlToMarkdown(wysiwyg);
      wysiwyg.classList.add('ek-hidden');
      raw.classList.remove('ek-hidden');
      mode = 'raw';
      modeToggle.textContent = 'View Rendered';
    } else {
      wysiwyg.innerHTML = renderMarkdown(raw.value);
      raw.classList.add('ek-hidden');
      wysiwyg.classList.remove('ek-hidden');
      mode = 'wysiwyg';
      modeToggle.textContent = 'View Markdown';
    }
  });
  toolbar.appendChild(modeToggle);

  root.append(toolbar, wysiwyg, raw);

  function getValue() {
    return mode === 'raw' ? raw.value : htmlToMarkdown(wysiwyg);
  }

  function setValue(markdown) {
    if (mode === 'raw') raw.value = markdown;
    else wysiwyg.innerHTML = renderMarkdown(markdown);
  }

  // Inserts a Markdown snippet (e.g. an uploaded image/diagram reference).
  // Cursor-position insertion is supported in raw mode; in WYSIWYG mode the
  // snippet is appended, since a toolbar click typically isn't preceded by
  // an in-editor text selection to insert at.
  function insertText(snippet) {
    if (mode === 'raw') {
      const start = raw.selectionStart ?? raw.value.length;
      const end = raw.selectionEnd ?? raw.value.length;
      raw.value = raw.value.slice(0, start) + snippet + raw.value.slice(end);
      raw.focus();
      raw.selectionStart = raw.selectionEnd = start + snippet.length;
    } else {
      wysiwyg.innerHTML += renderMarkdown(snippet);
    }
  }

  return { root, getValue, setValue, insertText };
}
