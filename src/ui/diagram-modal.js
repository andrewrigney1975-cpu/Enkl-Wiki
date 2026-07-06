import { openModal } from './modal.js';
import { createDiagramEditor } from '../diagram/diagram-editor.js';
import { recordUpload } from '../app/state.js';

export function showDiagramModal({ onExported } = {}) {
  const diagram = createDiagramEditor({});

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ek-btn ek-btn-primary';
  exportBtn.textContent = 'Export & Insert';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, exportBtn);

  const handle = openModal({ title: 'Diagram', bodyNode: diagram.root, footerNode: footer, size: 'lg' });
  cancelBtn.addEventListener('click', handle.close);

  exportBtn.addEventListener('click', async () => {
    const svgText = diagram.exportSvgText();
    const filename = `diagram-${Date.now()}.svg`;
    const upload = await recordUpload(new Blob([svgText], { type: 'image/svg+xml' }), filename);
    handle.close();
    if (onExported) onExported(upload);
  });

  return handle;
}
