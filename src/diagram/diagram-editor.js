// Hand-rolled SVG diagramming canvas. Shapes are placed via click-to-place
// (pick a palette shape, then click the canvas) rather than native HTML5
// drag-and-drop, which jsdom doesn't implement and which is fiddlier to get
// right on touch devices anyway. Moving a placed shape uses plain
// mousedown/mousemove/mouseup, which works the same way in a real browser
// and in a scripted test.
import { SHAPE_TYPES } from './diagram-shapes.js';
import { serializeDiagramToSvg } from './diagram-export.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function shapeCenter(shape) {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

export function createDiagramEditor({ initialData = null } = {}) {
  const state = initialData ? structuredClone(initialData) : { shapes: [], connectors: [] };
  let nextId = 1;
  let selectedShapeId = null;
  let selectedConnectorId = null;
  let connectMode = false;
  let connectorStyle = 'straight';
  let connectSourceId = null;
  let pendingShapeType = null;
  let dragState = null;

  const root = document.createElement('div');
  root.className = 'ek-diagram-editor';

  const toolbar = document.createElement('div');
  toolbar.className = 'ek-diagram-toolbar';

  const shapeButtons = new Map();
  for (const [type, def] of Object.entries(SHAPE_TYPES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ek-diagram-shape-btn';
    btn.textContent = def.label;
    btn.addEventListener('click', () => {
      pendingShapeType = pendingShapeType === type ? null : type;
      connectMode = false;
      updateToolbarState();
    });
    shapeButtons.set(type, btn);
    toolbar.appendChild(btn);
  }

  const connectBtn = document.createElement('button');
  connectBtn.type = 'button';
  connectBtn.className = 'ek-diagram-mode-btn';
  connectBtn.textContent = 'Connect';
  connectBtn.addEventListener('click', () => {
    connectMode = !connectMode;
    pendingShapeType = null;
    connectSourceId = null;
    updateToolbarState();
  });

  const curveLabel = document.createElement('label');
  curveLabel.className = 'ek-diagram-curve-toggle';
  const curveCheckbox = document.createElement('input');
  curveCheckbox.type = 'checkbox';
  curveCheckbox.addEventListener('change', () => {
    connectorStyle = curveCheckbox.checked ? 'curved' : 'straight';
  });
  curveLabel.append(curveCheckbox, document.createTextNode('Curved'));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'ek-btn ek-btn-danger ek-diagram-delete-btn';
  deleteBtn.textContent = 'Delete selected';
  deleteBtn.addEventListener('click', deleteSelected);

  toolbar.append(connectBtn, curveLabel, deleteBtn);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'ek-diagram-canvas-wrap';

  const svg = svgEl('svg', {
    class: 'ek-diagram-canvas', width: 900, height: 560, viewBox: '0 0 900 560'
  });

  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'ekDiagramArrow', markerWidth: 10, markerHeight: 10, refX: 8, refY: 5, orient: 'auto-start-reverse'
  });
  marker.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: 'ek-diagram-arrowhead' }));
  defs.appendChild(marker);

  const connectorLayer = svgEl('g', { class: 'ek-diagram-connectors' });
  const shapeLayer = svgEl('g', { class: 'ek-diagram-shapes' });
  svg.append(defs, connectorLayer, shapeLayer);
  canvasWrap.appendChild(svg);

  root.append(toolbar, canvasWrap);

  function updateToolbarState() {
    connectBtn.classList.toggle('active', connectMode);
    for (const [type, btn] of shapeButtons) btn.classList.toggle('active', pendingShapeType === type);
  }

  function findShape(id) {
    return state.shapes.find((s) => s.id === id);
  }

  function svgPoint(evt) {
    const rect = svg.getBoundingClientRect();
    return { x: (evt.clientX || 0) - (rect.left || 0), y: (evt.clientY || 0) - (rect.top || 0) };
  }

  function addShape(type, centerX, centerY) {
    const def = SHAPE_TYPES[type];
    if (!def) return null;
    const shape = { id: `s${nextId++}`, type, x: centerX - def.w / 2, y: centerY - def.h / 2, w: def.w, h: def.h, label: def.label };
    state.shapes.push(shape);
    selectedShapeId = shape.id;
    selectedConnectorId = null;
    render();
    return shape;
  }

  function addConnector(fromId, toId) {
    if (fromId === toId) return null;
    const connector = { id: `c${nextId++}`, fromId, toId, style: connectorStyle, label: '' };
    state.connectors.push(connector);
    render();
    return connector;
  }

  function deleteSelected() {
    if (selectedShapeId) {
      state.shapes = state.shapes.filter((s) => s.id !== selectedShapeId);
      state.connectors = state.connectors.filter((c) => c.fromId !== selectedShapeId && c.toId !== selectedShapeId);
      selectedShapeId = null;
    } else if (selectedConnectorId) {
      state.connectors = state.connectors.filter((c) => c.id !== selectedConnectorId);
      selectedConnectorId = null;
    }
    render();
  }

  function openInlineEditor({ x, y, width, height, value, onCommit }) {
    root.querySelector('.ek-diagram-inline-editor')?.remove();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ek-diagram-inline-editor';
    input.value = value || '';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = `${width}px`;
    input.style.height = `${height}px`;

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      onCommit(input.value.trim());
      input.remove();
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        committed = true;
        input.remove();
      }
    });
    input.addEventListener('blur', commit);

    canvasWrap.appendChild(input);
    input.focus();
    input.select();
  }

  function onShapeMouseDown(evt, shape) {
    if (connectMode) return;
    evt.preventDefault();
    const start = svgPoint(evt);
    dragState = { id: shape.id, startX: start.x, startY: start.y, origX: shape.x, origY: shape.y };
  }

  function onShapeClick(evt, shape) {
    evt.stopPropagation();
    if (connectMode) {
      if (!connectSourceId) {
        connectSourceId = shape.id;
      } else {
        addConnector(connectSourceId, shape.id);
        connectSourceId = null;
      }
      return;
    }
    selectedShapeId = shape.id;
    selectedConnectorId = null;
    render();
  }

  function renderShape(shape) {
    const def = SHAPE_TYPES[shape.type];
    const g = svgEl('g', {
      class: 'ek-diagram-shape' + (shape.id === selectedShapeId ? ' selected' : '') + (shape.id === connectSourceId ? ' connect-source' : ''),
      'data-id': shape.id,
      transform: `translate(${shape.x},${shape.y})`
    });
    g.innerHTML = def ? def.body(shape.w, shape.h) : '';
    for (const child of [...g.children]) child.classList.add('ek-diagram-shape-outline');

    const text = svgEl('text', {
      x: shape.w / 2, y: shape.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'ek-diagram-shape-label'
    });
    text.textContent = shape.label;
    g.appendChild(text);

    g.addEventListener('mousedown', (evt) => onShapeMouseDown(evt, shape));
    g.addEventListener('click', (evt) => onShapeClick(evt, shape));
    g.addEventListener('dblclick', (evt) => {
      evt.stopPropagation();
      openInlineEditor({
        x: shape.x, y: shape.y, width: shape.w, height: shape.h, value: shape.label,
        onCommit: (value) => { shape.label = value || def?.label || ''; render(); }
      });
    });

    return g;
  }

  function renderConnector(conn) {
    const from = findShape(conn.fromId);
    const to = findShape(conn.toId);
    if (!from || !to) return null;
    const a = shapeCenter(from);
    const b = shapeCenter(to);

    const g = svgEl('g', { class: 'ek-diagram-connector' + (conn.id === selectedConnectorId ? ' selected' : ''), 'data-id': conn.id });
    const line = conn.style === 'curved'
      ? svgEl('path', {
        d: `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 - 40} ${b.x},${b.y}`,
        class: 'ek-diagram-connector-line', fill: 'none', 'marker-end': 'url(#ekDiagramArrow)'
      })
      : svgEl('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'ek-diagram-connector-line', 'marker-end': 'url(#ekDiagramArrow)'
      });

    line.addEventListener('click', (evt) => {
      evt.stopPropagation();
      selectedConnectorId = conn.id;
      selectedShapeId = null;
      render();
    });
    line.addEventListener('dblclick', (evt) => {
      evt.stopPropagation();
      openInlineEditor({
        x: (a.x + b.x) / 2 - 40, y: (a.y + b.y) / 2 - 12, width: 80, height: 24, value: conn.label,
        onCommit: (value) => { conn.label = value; render(); }
      });
    });

    g.appendChild(line);
    if (conn.label) {
      const label = svgEl('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6, 'text-anchor': 'middle', class: 'ek-diagram-connector-label' });
      label.textContent = conn.label;
      g.appendChild(label);
    }
    return g;
  }

  function render() {
    connectorLayer.innerHTML = '';
    for (const conn of state.connectors) {
      const el = renderConnector(conn);
      if (el) connectorLayer.appendChild(el);
    }
    shapeLayer.innerHTML = '';
    for (const shape of state.shapes) shapeLayer.appendChild(renderShape(shape));
  }

  svg.addEventListener('mousemove', (evt) => {
    if (!dragState) return;
    const p = svgPoint(evt);
    const shape = findShape(dragState.id);
    if (!shape) return;
    shape.x = dragState.origX + (p.x - dragState.startX);
    shape.y = dragState.origY + (p.y - dragState.startY);
    render();
  });
  svg.addEventListener('mouseup', () => { dragState = null; });
  svg.addEventListener('mouseleave', () => { dragState = null; });

  svg.addEventListener('click', (evt) => {
    if (pendingShapeType) {
      const p = svgPoint(evt);
      addShape(pendingShapeType, p.x, p.y);
      pendingShapeType = null;
      updateToolbarState();
      return;
    }
    selectedShapeId = null;
    selectedConnectorId = null;
    render();
  });

  render();

  return {
    root,
    getData: () => structuredClone(state),
    exportSvgText: () => serializeDiagramToSvg(state),
    addShape,
    addConnector
  };
}
