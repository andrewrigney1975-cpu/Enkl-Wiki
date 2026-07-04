import { openModal } from './modal.js';

// Presents the three dispositions the spec calls for when deleting a page
// that has sub-pages, and resolves onResolve with one of:
//  { type: 'cascade' } | { type: 'repoint', newParentId } | { type: 'promote' }
export function showOrphanResolutionModal({ page, candidateParents, onResolve } = {}) {
  const body = document.createElement('div');

  const intro = document.createElement('p');
  intro.style.margin = '0 0 14px';
  intro.textContent = `"${page.title}" has sub-pages. What should happen to them?`;
  body.appendChild(intro);

  const form = document.createElement('div');
  form.className = 'ek-orphan-form';

  function radioRow(value, labelText, extraNode) {
    const row = document.createElement('label');
    row.className = 'ek-orphan-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'ekOrphanChoice';
    radio.value = value;
    const span = document.createElement('span');
    span.textContent = labelText;
    row.append(radio, span);
    if (extraNode) row.appendChild(extraNode);
    return { row, radio };
  }

  const parentSelect = document.createElement('select');
  parentSelect.className = 'ek-orphan-parent-select';
  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = '(choose a page)';
  parentSelect.appendChild(blankOption);
  for (const candidate of candidateParents) {
    const opt = document.createElement('option');
    opt.value = candidate.id;
    opt.textContent = candidate.title;
    parentSelect.appendChild(opt);
  }

  const cascade = radioRow('cascade', 'Delete the sub-pages too');
  const repoint = radioRow('repoint', 'Move the sub-pages under:', parentSelect);
  const promote = radioRow('promote', 'Make the sub-pages top-level pages');
  cascade.radio.checked = true;

  form.append(cascade.row, repoint.row, promote.row);
  body.appendChild(form);

  const errorBox = document.createElement('div');
  errorBox.className = 'ek-field-error ek-hidden';
  body.appendChild(errorBox);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ek-btn ek-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'ek-btn ek-btn-danger';
  confirmBtn.textContent = 'Delete Page';

  const footer = document.createElement('div');
  footer.className = 'ek-modal-footer-buttons';
  footer.append(cancelBtn, confirmBtn);

  const handle = openModal({ title: 'Sub-pages found', bodyNode: body, footerNode: footer, size: 'sm' });
  cancelBtn.addEventListener('click', handle.close);

  confirmBtn.addEventListener('click', () => {
    const choice = form.querySelector('input[name="ekOrphanChoice"]:checked').value;
    if (choice === 'repoint' && !parentSelect.value) {
      errorBox.textContent = 'Choose a page to move the sub-pages under.';
      errorBox.classList.remove('ek-hidden');
      return;
    }
    handle.close();
    if (onResolve) onResolve({ type: choice, newParentId: choice === 'repoint' ? parentSelect.value : null });
  });

  return handle;
}
