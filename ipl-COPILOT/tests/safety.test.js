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


test('analytics basics are wired safely', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(server, /ucm_analytics_db\.json/);
  assert.match(server, /ANALYTICS_ADMIN_TOKEN/);
  assert.match(server, /api\/analytics\/summary/);
  assert.match(html, /sendAnalytics/);
  assert.match(html, /session_ping/);
});


test('team logo database is complete', () => {
  const db = JSON.parse(fs.readFileSync(path.join(root, 'team_logos_db.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(db.teams.length, 10);
  for (const team of db.teams) {
    assert.match(team.logo, /^assets\/team-logos\/.+\.svg$/);
    assert(fs.existsSync(path.join(root, team.logo)), 'Missing logo asset for ' + team.name);
  }
  assert.match(html, /TEAM_LOGO_DB_URL/);
  assert.match(html, /teamLogoImgHtml/);
});
