import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeDiagramToSvg } from '../../src/diagram/diagram-export.js';

test('serializeDiagramToSvg produces a standalone SVG document with shapes and labels', () => {
  const svg = serializeDiagramToSvg({
    shapes: [{ id: 's1', type: 'process', x: 10, y: 20, w: 120, h: 56, label: 'Start' }],
    connectors: []
  });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<rect x="0" y="0" width="120" height="56" rx="4"\/>/);
  assert.match(svg, />Start</);
});

test('serializeDiagramToSvg draws a connector between two shapes and skips dangling ones', () => {
  const svg = serializeDiagramToSvg({
    shapes: [
      { id: 'a', type: 'process', x: 0, y: 0, w: 100, h: 50, label: 'A' },
      { id: 'b', type: 'process', x: 200, y: 0, w: 100, h: 50, label: 'B' }
    ],
    connectors: [
      { id: 'c1', fromId: 'a', toId: 'b', style: 'straight', label: 'yes' },
      { id: 'c2', fromId: 'a', toId: 'missing', style: 'straight', label: '' }
    ]
  });
  assert.match(svg, /<line x1="50" y1="25" x2="250" y2="25"/);
  assert.match(svg, />yes</);
  assert.equal((svg.match(/<line/g) || []).length, 1, 'the dangling connector should be skipped');
});

test('serializeDiagramToSvg escapes XML-sensitive characters in labels', () => {
  const svg = serializeDiagramToSvg({
    shapes: [{ id: 's1', type: 'process', x: 0, y: 0, w: 100, h: 50, label: '<script>&"\'' }],
    connectors: []
  });
  assert.match(svg, /&lt;script&gt;&amp;&quot;&apos;/);
  assert.ok(!svg.includes('<script>'));
});

test('serializeDiagramToSvg renders a curved connector as a quadratic path', () => {
  const svg = serializeDiagramToSvg({
    shapes: [
      { id: 'a', type: 'process', x: 0, y: 0, w: 100, h: 50, label: 'A' },
      { id: 'b', type: 'process', x: 200, y: 0, w: 100, h: 50, label: 'B' }
    ],
    connectors: [{ id: 'c1', fromId: 'a', toId: 'b', style: 'curved', label: '' }]
  });
  assert.match(svg, /<path d="M50,25 Q150,-15 250,25"/);
});
