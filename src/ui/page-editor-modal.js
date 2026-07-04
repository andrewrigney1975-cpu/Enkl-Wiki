import { openModal } from './modal.js';
import { createMarkdownEditor } from '../content/markdown-editor.js';
import { createEditorPanel } from './editor-panel.js';
import { showUploadModal } from './upload-modal.js';
import { showDiagramModal } from './diagram-modal.js';
import { iconMarkup } from './icons.js';
import { createPage } from '../content/page-model.js';
import { findOrCreateTag, parseTagTokens, tagNamesForIds } from '../content/tag-model.js';
import { getConfig, getProvider, getPages, getTags, getUploads, persist, notifyChanged } from '../app/state.js';

// Page slugs are assigned once at creation and never change on rename, so
// existing #!/slug links and bookmarks keep working after an edit.
export function showPageEditorModal({ mode, page = null, parentId = null, onSaved } = {}) {
  const isCreate = mode === 'create';

  const container = document.createElement('div');
  container.className = 'ek-page-editor';

  const mainCol = document.createElement('div');
  mainCol.className = 'ek-page-editor-main';

  const titleField = document.createElement('div');
  titleField.className = 'ek-field';
  titleField.innerHTML = '<label for="ekPageTitleInput">Title</label>';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'ekPageTitleInput';
  titleInput.maxLength = 120;
  titleInput.value = page ? page.title : '';
  titleField.appendChild(titleInput);

  const tagsField = document.createElement('div');
  tagsField.className = 'ek-field';
  tagsField.innerHTML = '<label for="ekPageTagsInput">Tags <span class="ek-field-hint">(space or comma separated)</span></label>';
  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.id = 'ekPageTagsInput';
  tagsInput.value = page ? tagNamesForIds(getTags(), page.tagIds || []).map((n) => `#${n}`).join(' ') : '';
  tagsField.appendChild(tagsInput);

  const bodyField = document.createElement('div');
  bodyField.className = 'ek-field';
  bodyField.innerHTML = '<label>Body</label>';
  const editorMount = document.createElement('div');
  editorMount.innerHTML = '<div class="ek-placeholder">Loading&hellip;</div>';
  bodyField.appendChild(editorMount);

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';

  mainCol.append(titleField, tagsField, bodyField, errorBox);

  container.appendChild(mainCol);
  container.appendChild(createEditorPanel({ pages: getPages(), uploads: getUploads().map((u) => u.filename) }));

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'ek-btn ek-btn-primary';
  saveBtn.textContent = 'Save';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, saveBtn);

  const handle = openModal({
    title: isCreate ? 'New Page' : 'Edit Page',
    bodyNode: container,
    footerNode: footer,
    size: 'lg'
  });
  cancelBtn.addEventListener('click', handle.close);
  titleInput.focus();

  let editor = null;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('ek-hidden');
  }

  (async () => {
    const initialBody = isCreate ? '' : await getProvider().getPageBody(page);
    editor = createMarkdownEditor({ initialValue: initialBody });
    editorMount.innerHTML = '';
    editorMount.appendChild(editor.root);

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'ek-md-toolbar-btn';
    uploadBtn.title = 'Upload a file';
    uploadBtn.innerHTML = iconMarkup('upload', 15);
    uploadBtn.addEventListener('click', () => {
      showUploadModal({ onUploaded: (filename) => editor.insertText(`![](uploads/${filename})`) });
    });

    const diagramBtn = document.createElement('button');
    diagramBtn.type = 'button';
    diagramBtn.className = 'ek-md-toolbar-btn';
    diagramBtn.title = 'Insert a diagram';
    diagramBtn.innerHTML = iconMarkup('diagram', 15);
    diagramBtn.addEventListener('click', () => {
      showDiagramModal({ onExported: (filename) => editor.insertText(`![diagram](uploads/${filename})`) });
    });

    const toolbar = editor.root.querySelector('.ek-md-toolbar');
    const modeToggle = toolbar.querySelector('.ek-md-mode-toggle');
    toolbar.insertBefore(uploadBtn, modeToggle);
    toolbar.insertBefore(diagramBtn, modeToggle);
  })();

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      showError('Title is required.');
      return;
    }
    if (!editor) return; // still loading the existing body

    const markdown = editor.getValue();
    const config = getConfig();

    const explicitTagNames = tagsInput.value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const tagIds = [];
    for (const raw of [...explicitTagNames, ...parseTagTokens(markdown)]) {
      const tag = findOrCreateTag(config.tags, raw);
      if (tag && !tagIds.includes(tag.id)) tagIds.push(tag.id);
    }

    let targetPage = page;
    if (isCreate) {
      targetPage = createPage({ title, parentId, existingSlugs: getPages().map((p) => p.slug) });
      config.pages.push(targetPage);
    } else {
      targetPage.title = title;
    }
    targetPage.tagIds = tagIds;

    await getProvider().savePageBody(targetPage, markdown);
    persist();
    notifyChanged();
    handle.close();
    if (onSaved) onSaved(targetPage);
  });

  return handle;
}
