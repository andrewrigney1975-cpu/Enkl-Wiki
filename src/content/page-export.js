import { triggerDownload } from '../storage/file-io.js';

const STANDALONE_STYLES = `
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.7;color:#172b4d;}
h1,h2,h3{line-height:1.3;}
pre{background:#f1f2f4;padding:12px 14px;border-radius:4px;overflow-x:auto;}
code{background:#f1f2f4;border-radius:3px;padding:1px 5px;}
pre code{background:none;padding:0;}
img,video{max-width:100%;border-radius:4px;}
audio{width:100%;}
blockquote{border-left:3px solid #c1c7d0;margin:0 0 16px;padding:2px 16px;color:#6b778c;}
table{border-collapse:collapse;margin-bottom:16px;}
table.ek-table-full{width:100%;}
th,td{border:1px solid #dfe1e6;padding:6px 10px;text-align:left;}
.token.comment{color:#8993a4;font-style:italic;}
.token.string,.token.char,.token.attr-value{color:#216e4e;}
.token.number,.token.boolean,.token.constant,.token.symbol{color:#974f0c;}
.token.keyword,.token.atrule,.token.important,.token.regex{color:#944df3;}
.token.function,.token.class-name{color:#0c66e4;}
.token.tag,.token.selector,.token.deleted{color:#ae2e24;}
.token.attr-name,.token.builtin,.token.inserted{color:#974f0c;}
.token.punctuation,.token.operator,.token.entity,.token.url{color:#6b778c;}
`.trim();

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// bodyHtml is the already-rendered HTML5 for the page (see markdown.js) —
// this just wraps it as a standalone, self-styled document.
export function buildStandaloneHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${STANDALONE_STYLES}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>
`;
}

export function exportPageAsHtml(page, bodyHtml) {
  const html = buildStandaloneHtml(page.title, bodyHtml);
  const filename = `${page.slug || 'page'}.html`;
  triggerDownload(filename, new Blob([html], { type: 'text/html' }));
  return filename;
}
