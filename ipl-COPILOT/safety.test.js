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

test('admin analytics dashboard is password protected under UCM logo', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(server, /ANALYTICS_ADMIN_TOKEN = process\.env\.ANALYTICS_ADMIN_TOKEN \|\| 'keshav199507'/);
  assert.match(server, /totalVisitorsToday/);
  assert.match(server, /mostClickedButtons/);
  assert.match(server, /deviceTypes/);
  assert.match(server, /locations/);
  assert.match(html, /openAdminAnalyticsLogin/);
  assert.match(html, /loadAdminAnalyticsDashboard/);
  assert.match(html, /\/api\/analytics\/summary\?token=/);
  assert.match(html, /ucm-logo-secret/);
});


test('team logo database is complete', () => {
  const db = JSON.parse(fs.readFileSync(path.join(root, 'team_logos_db.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(db.teams.length, 10);
  for (const team of db.teams) {
    assert.match(team.logo, /^assets\/team-logos\/optimized\/.+\.jpg$/);
    assert(fs.existsSync(path.join(root, team.logo)), 'Missing optimized logo asset for ' + team.name);
    assert.equal(team.exactLogo, team.logo);
    assert.equal(team.fallbackLogo, team.logo);
    assert.deepEqual(team.exactLogos, [team.logo]);
  }
  assert.match(html, /TEAM_LOGO_DB_URL/);
  assert.match(html, /teamLogoImgHtml/);
});


test('franchise selection uses logo tiles in two columns', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('.team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(5,clamp(68px,11vh,88px));'), 'Team grid should stay compact at two columns and five rows');
  assert.match(html, /team-card-logo-art/);
  assert.match(html, /preferredTeamLogoSrc/);
  assert(!html.includes('.team-grid{grid-template-columns:1fr'), 'Team grid should not collapse to one column');
});


test('match screen exposes top match controls', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /match-actions-top/);
  assert.match(html, /id="nextMyMatchBtn"/);
  assert.match(html, /id="matchHistoryBtn"/);
  assert.match(html, /id="seasonLeadersBtn"/);
  assert.match(html, /advanceToNextUserMatch/);
  assert.match(html, /applyMatchInfoPanelVisibility/);
});

test('auction room interface has activity, squad, community, and settings tabs', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /class="auction-room-bar"/);
  assert.match(html, /id="auctionPauseBtn"/);
  assert.match(html, /id="auctionEndBtn"/);
  assert.match(html, /id="auctionPlaySimBtn"/);
  assert.match(html, /data-auction-tab="activity"/);
  assert.match(html, /data-auction-tab="squad"/);
  assert.match(html, /data-auction-tab="community"/);
  assert.match(html, /data-auction-tab="settings"/);
  assert.match(html, /https:\/\/frameogram\.onrender\.com\//);
  assert.match(html, /function renderAuctionActivityTab/);
  assert.match(html, /function renderAuctionSquadTab/);
  assert.match(html, /function sendAuctionChat/);
  assert.match(html, /function toggleAuctionPause/);
  assert.match(html, /function guardAuctionHostControl/);
  assert.match(html, /Only the room creator can use this control/);
});

test('mobile auction screen uses compact current-lot layout', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /auction-timer-progress/);
  assert.match(html, /auctionMobileHistoryBtn/);
  assert.match(html, /auctionPlayerMenuPanel/);
  assert.match(html, /openAuctionPlayerMenu/);
  assert.match(html, /mobile-bidder-badge/);
  assert.match(html, /mobile-purse-row/);
  assert.match(html, /#auctionScreen>aside\.auction-panel\{display:none;\}/);
  assert.doesNotMatch(html, /#auctionScreen>\.auction-panel:first-of-type\{display:none;\}/);
  assert.match(html, /data-room-mode="solo"|dataset\.roomMode/);
  assert.match(html, /#auctionScreen\[data-room-mode="solo"\] #auctionRoomCode/);
  assert.match(html, /#auctionScreen\[data-lot-active="1"\] #startAuctionBtn/);
  assert.match(html, /#auctionScreen\[data-lot-active="0"\] #userBidBtn/);
  assert.match(html, /auctionScreen\.dataset\.lotActive/);
  assert.match(html, /Frameogram Optical Store/);
  assert.match(html, /getAuctionCareerStats/);
  assert(!html.includes('content:"' + String.fromCharCode(226)), 'Mobile CSS should not use mojibake icon text');
  assert.match(html, /state\.selectedPlayer = state\.players\s*\.filter\(p => !state\.sold\.has\(p\.id\)/);
});

test('home name gate and solo game mode selection are wired', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="homeNameInput"/);
  assert.match(html, /Please enter your name to continue\./);
  assert.match(html, /START SOLO GAME/);
  assert.match(html, /id="modeScreen"/);
  assert.match(html, /AI Mode/);
  assert.match(html, /Historical Mode/);
  assert.match(html, /id="aiModeBtn"/);
  assert.match(html, /id="historicalModeBtn"/);
  assert.match(html, /aiModeBtn"\)\?\.addEventListener\("click"/);
  assert.match(html, /function goToSoloModeSelection/);
  assert.match(html, /function startSoloGameMode/);
  assert.match(html, /function goToTeamSelection\(\) {\s*goToSoloModeSelection\(\);/);
  assert.match(html, /function resetSoloGameState/);
  assert.match(html, /prepareTeamScreen\("ai", null\);\s*showOnlyScreen\("teamScreen"\);/);
  assert.match(html, /resetRoomAuctionState\(\);\s*resetTournamentForActiveTeams\(\);\s*showOnlyScreen\("auctionScreen"\);/);
});

test('AI 2027 simulation mode avoids historical stats and calls backend', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(html, /GAME_MODE_AI_2027 = "ai2027"/);
  assert.match(html, /function simulateAIMatch2027/);
  assert.match(html, /\/api\/ai\/simulate-match/);
  assert.match(html, /Match Year: 2027/);
  assert.match(html, /Gemini simulation unavailable:/);
  assert.match(html, /AI Mode setup needed:/);
  assert.match(html, /Do not add wicket bonus runs in AI Mode/);
  assert.match(html, /applyWicketBonus:false/);
  assert.match(html, /innings1\.finalRuns = innings1\.runs/);
  assert.match(html, /innings2\.finalRuns = innings2\.runs/);
  assert.doesNotMatch(html, /The game will add 25 bonus runs per bowling wicket after the response/);
  assert.match(server, /GEMINI_API_KEY/);
  assert.match(server, /runGeminiMatchSimulation/);
  assert.match(server, /generativelanguage\.googleapis\.com/);
  assert.match(server, /GEMINI_TIMEOUT_MS/);
  assert.match(server, /AbortController/);
  assert.match(server, /extractFirstJsonObject/);
  assert.match(server, /maxOutputTokens: 4200/);
  assert.match(server, /\/api\/ai\/status/);
  assert.match(server, /\/api\/ai\/simulate-match/);
  assert.match(server, /GEMINI_NOT_CONFIGURED/);
  assert.match(server, /AI_SIMULATION_RULEBOOK/);
});

test('local 2027 fallback has stronger cricket simulation safeguards', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /function effectiveBattingSkill/);
  assert.match(html, /function effectiveBowlingSkill/);
  assert.match(html, /function bowlingPhaseFit/);
  assert.match(html, /function reconcileLocalInningsScorecard/);
  assert.match(html, /function reconcileInningsScorecard/);
  assert.match(html, /function distributeBowlingBalls/);
  assert.match(html, /function distributeColumnTotal/);
  assert.match(html, /reconcileInningsScorecard\(innings, \{ preserveRuns:true, preserveWickets:true, preserveBalls:true \}\)/);
  assert.match(html, /if \(over !== overNo \|\| !overBowler\)/);
  assert.match(html, /preferred\.length >= 5/);
  assert.match(html, /canEmergencyBowl/);
  assert.match(html, /currentTournamentMatchNumber\(\) < 2/);
  assert.match(html, /Gemini request timed out/);
});


test('league schedule is strict double round-robin', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = html.indexOf('function leaguePairKey');
  const end = html.indexOf('// Initialize points table', start);
  assert(start > -1 && end > start, 'Could not extract schedule helpers');
  const source = html.slice(start, end);
  const allTeams = ['Mumbai Mavericks', 'Delhi Strikers', 'Bengaluru Blazers', 'Chennai Chargers', 'Kolkata Knightsmen', 'Rajasthan Riders', 'Hyderabad Hawks', 'Punjab Panthers', 'Gujarat Gladiators', 'Lucknow Lions'];
  for (const size of [2, 3, 4, 7, 10]) {
    const teamNames = allTeams.slice(0, size);
    const activeAuctionTeams = () => teamNames.map(name => ({ name }));
    const schedule = new Function('activeAuctionTeams', source + '; return buildSchedule();')(activeAuctionTeams);
    assert.equal(schedule.length, teamNames.length * (teamNames.length - 1), 'bad fixture count for ' + size + ' teams');
    const teamCounts = Object.fromEntries(teamNames.map(name => [name, 0]));
    const pairCounts = {};
    for (const fixture of schedule) {
      teamCounts[fixture.home] += 1;
      teamCounts[fixture.away] += 1;
      const key = [fixture.home, fixture.away].sort().join('::');
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    }
    for (const count of Object.values(teamCounts)) assert.equal(count, (size - 1) * 2, 'bad team count for ' + size + ' teams');
    for (const count of Object.values(pairCounts)) assert.equal(count, 2, 'bad pair count for ' + size + ' teams');
  }
});

test('league fixtures cannot be counted twice in points table', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /playedFixtures/);
  assert.match(html, /function isCurrentFixtureAlreadyPlayed/);
  assert.match(html, /This fixture has already been simulated\. Click Next Match\./);
  assert.match(html, /markCurrentFixturePlayed\(\)/);
  assert.match(html, /function leagueHistoryFixtureKey/);
  assert.match(html, /function rebuildPointsTableFromUniqueLeagueMatches/);
  assert.match(html, /h\.leagueMatchNo != null/);
  assert.match(html, /fixture\.stage !== "League"/);
  assert.match(html, /seen\.has\(key\)/);
  assert.match(html, /function sortedStandings\(\) {\s*rebuildPointsTableFromUniqueLeagueMatches\(\);/);
  assert.match(html, /function renderPointsTable\(\) {\s*rebuildPointsTableFromUniqueLeagueMatches\(\);/);
});

test('skip auction is chunked and auction history hides bid trails', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /async function skipAuction/);
  assert.match(html, /auctionWorkYield/);
  assert.match(html, /bulkMarkAuctionUnsold/);
  assert.doesNotMatch(html, /r\.bidTrail/);
  assert.doesNotMatch(html, /bidTrail:bids\.map/);
});


test('historical bowling does not invent overs for batting-only records', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /function hasHistoricalBowlingRecord/);
  assert(html.includes('if (!hasHistoricalBowlingRecord(historical, bowler)) return;'));
  assert.match(html, /wickets > 0\) return true/);
  assert(html.includes('role.includes("bowler")'));
});

test('injuries affect match availability and XI selection', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="injuryPanel"/);
  assert.match(html, /id="ruleInjury"/);
  assert.match(html, /function isPlayerInjured/);
  assert.match(html, /function removeInjuredFromTeamXI/);
  assert.match(html, /function ensureMatchTeamsReady/);
  assert.match(html, /function rollTeamMatchInjuries/);
  assert.match(html, /function forceFirstSeasonInjuryIfNeeded/);
  assert.match(html, /function applyPostMatchFitnessAndInjuries/);
  assert.match(html, /injuryLog/);
  assert.match(html, /injuredMatches:Number\(p\.injuredMatches \|\| 0\)/);
  assert.match(html, /team\.xi = \(snap\.xiIds \|\| \[\]\)\.map\(id => squadById\.get\(id\)\)/);
  assert.match(html, /Remove injured players from XI, captaincy, or Impact Player/);
  assert.match(html, /filter\(p => !isPlayerInjured\(p\)\)/);
});
