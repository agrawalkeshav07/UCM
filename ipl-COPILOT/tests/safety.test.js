const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('public app uses UCM branding and fictional teams', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /Ultimate Cricket Manager/);
  assert.match(html, /Mumbai Mavericks/);
  assert.match(html, /Delhi Strikers/);
  const bannedTerms = ['Mumbai' + ' Indians', 'Chennai' + ' Super Kings', 'Royal' + ' Challengers Bangalore', 'Indian' + ' Premier League'];
  for (const term of bannedTerms) assert(!html.includes(term), 'Found risky branding: ' + term);
});

test('server has production-ready multiplayer basics', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.match(server, /ucm_rooms_db.json/);
  assert.match(server, /sessionToken/);
  assert.match(server, /checkRate/);
  assert.match(server, /assertRoomPlayer/);
});

test('CSS root defines bg-glass variable', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /--bg-glass:/);
});
