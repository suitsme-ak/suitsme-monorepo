'use strict';
// Builds public/fabric-library-data.js from data/fabric-library.json,
// the normalized import of the shop fabric library (JPOS fabrics table
// plus its web curation lists, export dated 2026-11-04). The library
// carries every suit and shirt fabric, active and inactive; the
// fabrics pages open on the active set and mark inactive fabrics.
// Regenerate the source JSON from a fresh JPOS export with the
// normalization step recorded in the fabric alignment notes, then run
// this builder through the normal website build.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data', 'fabric-library.json'), 'utf8'));
if (!source || !Array.isArray(source.fabrics)) throw new Error('data/fabric-library.json has no fabrics array');
for (const kind of ['suit', 'shirt']) {
  const rows = source.fabrics.filter(f => f.k === kind);
  if (!rows.length) throw new Error('fabric library has no ' + kind + ' fabrics');
  if (!rows.some(f => f.act === 1)) throw new Error('fabric library has no active ' + kind + ' fabrics');
}
const out = 'const fabricLibraryData=' + JSON.stringify(source) + ';\n';
fs.writeFileSync(path.join(root, 'public', 'fabric-library-data.js'), out);
const suit = source.fabrics.filter(f => f.k === 'suit'), shirt = source.fabrics.filter(f => f.k === 'shirt');
console.log('fabric-library-data.js: suit ' + suit.length + ' (' + suit.filter(f => f.act).length + ' active), shirt ' + shirt.length + ' (' + shirt.filter(f => f.act).length + ' active)');
