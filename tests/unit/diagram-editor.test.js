import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from '../helpers/dom-env.js';
import { createDiagramEditor } from '../../src/diagram/diagram-editor.js';

function click(el, coords = {}) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, ...coords }));
}

test('clicking a palette shape then the canvas places a shape at that point', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const processBtn = [...editor.root.querySelectorAll('.ek-diagram-shape-btn')].find((b) => b.textContent === 'Process');
  click(processBtn);
  const svg = editor.root.querySelector('.ek-diagram-canvas');
  click(svg, { clientX: 200, clientY: 150 });

  const data = editor.getData();
  assert.equal(data.shapes.length, 1);
  assert.equal(data.shapes[0].type, 'process');
  // Placed centered on the click point.
  assert.equal(data.shapes[0].x + data.shapes[0].w / 2, 200);
  assert.equal(data.shapes[0].y + data.shapes[0].h / 2, 150);

  teardownDom();
});

test('connect mode draws a connector between two clicked shapes', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const a = editor.addShape('process', 100, 100);
  const b = editor.addShape('decision', 400, 100);

  editor.root.querySelector('.ek-diagram-mode-btn').click();
  const shapeEls = () => [...editor.root.querySelectorAll('.ek-diagram-shape')];
  const shapeEl = (id) => shapeEls().find((el) => el.dataset.id === id);

  click(shapeEl(a.id));
  click(shapeEl(b.id));

  const data = editor.getData();
  assert.equal(data.connectors.length, 1);
  assert.equal(data.connectors[0].fromId, a.id);
  assert.equal(data.connectors[0].toId, b.id);
  assert.equal(data.connectors[0].style, 'straight');

  teardownDom();
});

test('the Curved checkbox affects newly created connectors', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const a = editor.addShape('process', 0, 0);
  const b = editor.addShape('process', 300, 0);

  const curveCheckbox = editor.root.querySelector('.ek-diagram-curve-toggle input');
  curveCheckbox.checked = true;
  curveCheckbox.dispatchEvent(new window.Event('change'));
  editor.root.querySelector('.ek-diagram-mode-btn').click();
  const shapeEl = (id) => [...editor.root.querySelectorAll('.ek-diagram-shape')].find((el) => el.dataset.id === id);
  click(shapeEl(a.id));
  click(shapeEl(b.id));

  assert.equal(editor.getData().connectors[0].style, 'curved');
  teardownDom();
});

test('dragging a shape updates its position', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const shape = editor.addShape('process', 100, 100);
  const { x: origX, y: origY } = shape; // capture before the drag mutates `shape` in place
  const svg = editor.root.querySelector('.ek-diagram-canvas');
  const shapeEl = () => editor.root.querySelector(`.ek-diagram-shape[data-id="${shape.id}"]`);

  shapeEl().dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }));
  svg.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 130, clientY: 120 }));
  svg.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

  const moved = editor.getData().shapes[0];
  assert.equal(moved.x, origX + 30);
  assert.equal(moved.y, origY + 20);

  teardownDom();
});

test('double-clicking a shape opens an inline editor that renames it on Enter', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const shape = editor.addShape('process', 100, 100);
  const shapeEl = editor.root.querySelector(`.ek-diagram-shape[data-id="${shape.id}"]`);

  shapeEl.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
  const input = editor.root.querySelector('.ek-diagram-inline-editor');
  assert.ok(input);
  input.value = 'Renamed';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

  assert.equal(editor.getData().shapes[0].label, 'Renamed');
  teardownDom();
});

test('Delete selected removes a shape and any connectors touching it', () => {
  setupDom();
  const editor = createDiagramEditor({});
  const a = editor.addShape('process', 0, 0);
  const b = editor.addShape('process', 300, 0);
  editor.addConnector(a.id, b.id);

  const shapeEl = (id) => editor.root.querySelector(`.ek-diagram-shape[data-id="${id}"]`);
  click(shapeEl(a.id)); // select it
  editor.root.querySelector('.ek-diagram-delete-btn').click();

  const data = editor.getData();
  assert.equal(data.shapes.length, 1);
  assert.equal(data.shapes[0].id, b.id);
  assert.equal(data.connectors.length, 0);

  teardownDom();
});

test('exportSvgText reflects the current diagram state', () => {
  setupDom();
  const editor = createDiagramEditor({});
  editor.addShape('user', 50, 50);
  assert.match(editor.exportSvgText(), /User/);
  teardownDom();
});
