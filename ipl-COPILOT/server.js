const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// This small Node server hosts the UCM web app and keeps multiplayer rooms synced.
// Rooms are persisted to a JSON file so a normal server restart does not instantly erase them.
const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const ROOM_DB_FILE = process.env.ROOM_DB_FILE || path.join(ROOT, 'ucm_rooms_db.json');
const ANALYTICS_DB_FILE = process.env.ANALYTICS_DB_FILE || path.join(ROOT, 'ucm_analytics_db.json');
const ANALYTICS_ADMIN_TOKEN = process.env.ANALYTICS_ADMIN_TOKEN || 'keshav199507';
const HOST_TIMEOUT_MS = Number(process.env.HOST_TIMEOUT_MS || 2 * 60 * 1000);
const TEAM_NAMES = [
  'Mumbai Mavericks', 'Delhi Strikers', 'Bengaluru Blazers', 'Chennai Chargers', 'Kolkata Knightsmen',
  'Rajasthan Riders', 'Hyderabad Hawks', 'Punjab Panthers', 'Gujarat Gladiators', 'Lucknow Lions'
];
const ALLOWED_ACTIONS = new Set(['bid', 'pass', 'xi', 'simulateMatch', 'nextMatch']);
const rooms = new Map();
const clients = new Map();
const rateBuckets = new Map();
let saveTimer = null;
let analyticsSaveTimer = null;

function now() { return Date.now(); }
const analyticsDb = {
  version: 1,
  savedAt: now(),
  totals: { roomsCreated:0, roomJoins:0, starts:0, leaves:0, clicks:0, sessionPings:0, timeSpentMs:0, events:0 },
  rooms: {},
  users: {},
  sessions: {},
  events: []
};
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
function makePlayerId() { return 'P' + now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function normalizeCode(code) { return String(code || '').trim().toUpperCase(); }
function validCode(code) { return /^[0-9A-Z]{6}$/.test(normalizeCode(code)); }
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim(); }
function touchRoom(room) { room.updatedAt = now(); scheduleSave(); }
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRooms, 120);
}
function saveRooms() {
  try {
    const payload = { version: 1, savedAt: now(), rooms: Array.from(rooms.values()) };
    fs.writeFileSync(ROOM_DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Could not save room database:', e.message);
  }
}
function loadRooms() {
  try {
    if (!fs.existsSync(ROOM_DB_FILE)) return;
    const payload = JSON.parse(fs.readFileSync(ROOM_DB_FILE, 'utf8'));
    for (const room of payload.rooms || []) {
      if (room && validCode(room.code) && Array.isArray(room.players)) rooms.set(room.code, room);
    }
    console.log('Loaded UCM room database:', rooms.size, 'rooms');
  } catch (e) {
    console.error('Could not load room database:', e.message);
  }
}
loadRooms();
loadAnalytics();

function sanitizeAnalyticsText(value, max = 80) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}
function detectDeviceType(req, body = {}) {
  const explicit = sanitizeAnalyticsText(body.deviceType || '', 20).toLowerCase();
  if (['mobile', 'tablet', 'desktop'].includes(explicit)) return explicit;
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}
function analyticsLocation(req, body = {}) {
  const country = sanitizeAnalyticsText(
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-appengine-country'] ||
    body.country ||
    '',
    40
  ) || 'Unknown';
  const city = sanitizeAnalyticsText(
    req.headers['x-vercel-ip-city'] ||
    req.headers['x-appengine-city'] ||
    body.city ||
    '',
    60
  );
  return { country, city };
}
function countBy(list, pickKey) {
  return list.reduce((acc, item) => {
    const key = sanitizeAnalyticsText(pickKey(item) || 'Unknown', 100) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function topCounts(counts, limit = 10) {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}
function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function activeSinceMs() { return now() - 5 * 60 * 1000; }
function ensureAnalyticsRoom(code) {
  const roomCode = normalizeCode(code);
  if (!roomCode) return null;
  if (!analyticsDb.rooms[roomCode]) analyticsDb.rooms[roomCode] = { code:roomCode, createdAt:now(), players:{}, joins:0, starts:0, leaves:0, clicks:0, timeSpentMs:0, lastSeen:now() };
  return analyticsDb.rooms[roomCode];
}
function ensureAnalyticsSession(sessionId) {
  const id = sanitizeAnalyticsText(sessionId, 64) || 'unknown';
  if (!analyticsDb.sessions[id]) analyticsDb.sessions[id] = { id, firstSeen:now(), lastSeen:now(), events:0, clicks:0, timeSpentMs:0, roomCode:null, playerId:null, name:null, team:null };
  return analyticsDb.sessions[id];
}
function scheduleAnalyticsSave() {
  clearTimeout(analyticsSaveTimer);
  analyticsSaveTimer = setTimeout(saveAnalytics, 250);
}
function saveAnalytics() {
  try {
    analyticsDb.savedAt = now();
    fs.writeFileSync(ANALYTICS_DB_FILE, JSON.stringify(analyticsDb, null, 2), 'utf8');
  } catch (e) {
    console.error('Could not save analytics database:', e.message);
  }
}
function loadAnalytics() {
  try {
    if (!fs.existsSync(ANALYTICS_DB_FILE)) return;
    const payload = JSON.parse(fs.readFileSync(ANALYTICS_DB_FILE, 'utf8'));
    if (!payload || typeof payload !== 'object') return;
    analyticsDb.version = payload.version || 1;
    analyticsDb.savedAt = payload.savedAt || now();
    analyticsDb.totals = { ...analyticsDb.totals, ...(payload.totals || {}) };
    analyticsDb.rooms = payload.rooms || {};
    analyticsDb.users = payload.users || {};
    analyticsDb.sessions = payload.sessions || {};
    analyticsDb.events = Array.isArray(payload.events) ? payload.events.slice(-1000) : [];
    console.log('Loaded UCM analytics database:', Object.keys(analyticsDb.sessions).length, 'sessions');
  } catch (e) {
    console.error('Could not load analytics database:', e.message);
  }
}
function recomputeTotalTimeSpent() {
  analyticsDb.totals.timeSpentMs = Object.values(analyticsDb.sessions).reduce((sum, item) => sum + Number(item.timeSpentMs || 0), 0);
}
function recordAnalyticsEvent(req, body = {}, trusted = {}) {
  const t = now();
  const type = sanitizeAnalyticsText(trusted.type || body.type || 'event', 40);
  const roomCode = normalizeCode(trusted.roomCode || body.roomCode || '');
  const playerId = sanitizeAnalyticsText(trusted.playerId || body.playerId || '', 64);
  const sessionId = sanitizeAnalyticsText(body.analyticsSessionId || trusted.analyticsSessionId || '', 64) || (playerId ? 'player-' + playerId : 'unknown');
  const visitorId = sanitizeAnalyticsText(body.visitorId || trusted.visitorId || '', 64);
  const session = ensureAnalyticsSession(sessionId);
  const room = roomCode ? ensureAnalyticsRoom(roomCode) : null;
  const label = sanitizeAnalyticsText(body.label || trusted.label || '', 100);
  const screen = sanitizeAnalyticsText(body.screen || trusted.screen || '', 40);
  const name = sanitizeAnalyticsText(trusted.name || body.name || session.name || '', 32);
  const team = sanitizeAnalyticsText(trusted.team || body.team || session.team || '', 50);
  const deviceType = detectDeviceType(req, body);
  const location = analyticsLocation(req, body);
  const deltaMs = Math.max(0, Math.min(30 * 60 * 1000, Number(body.timeSpentMs || body.deltaMs || 0)));

  session.lastSeen = t;
  session.events += 1;
  if (roomCode) session.roomCode = roomCode;
  if (playerId) session.playerId = playerId;
  if (visitorId) session.visitorId = visitorId;
  if (name) session.name = name;
  if (team) session.team = team;
  session.deviceType = deviceType;
  session.country = location.country;
  session.city = location.city;

  if (type === 'click') {
    session.clicks += 1;
    analyticsDb.totals.clicks += 1;
    if (room) room.clicks += 1;
  }
  if (type === 'session_ping' || type === 'session_end') {
    session.timeSpentMs = Math.max(session.timeSpentMs || 0, deltaMs);
    analyticsDb.totals.sessionPings += 1;
    recomputeTotalTimeSpent();
    if (room) room.timeSpentMs = Math.max(room.timeSpentMs || 0, session.timeSpentMs || 0);
  }
  if (room) {
    room.lastSeen = t;
    if (playerId) room.players[playerId] = { playerId, name:name || undefined, team:team || undefined, lastSeen:t, sessionId };
  }

  analyticsDb.totals.events += 1;
  const event = { id:analyticsDb.totals.events, at:t, type, roomCode:roomCode || undefined, playerId:playerId || undefined, name:name || undefined, team:team || undefined, sessionId, screen:screen || undefined, label:label || undefined, deviceType, country:location.country, city:location.city || undefined };
  analyticsDb.events.push(event);
  if (analyticsDb.events.length > 1000) analyticsDb.events = analyticsDb.events.slice(-1000);
  scheduleAnalyticsSave();
  return event;
}
function recordRoomJoinAnalytics(req, room, playerId, kind, body = {}) {
  const player = room.players.find(p => p.id === playerId) || {};
  const analyticsRoom = ensureAnalyticsRoom(room.code);
  analyticsRoom.joins += 1;
  analyticsRoom.players[playerId] = { playerId, name:player.name, team:player.team, joinedAt:now(), lastSeen:now(), sessionId:sanitizeAnalyticsText(body.analyticsSessionId || '', 64) || undefined };
  analyticsDb.users[playerId] = { playerId, name:player.name, team:player.team, roomCode:room.code, firstSeen:analyticsDb.users[playerId]?.firstSeen || now(), lastSeen:now(), joins:(analyticsDb.users[playerId]?.joins || 0) + 1 };
  if (kind === 'create') analyticsDb.totals.roomsCreated += 1;
  analyticsDb.totals.roomJoins += 1;
  recordAnalyticsEvent(req, { ...body, type:kind === 'create' ? 'room_created' : 'room_joined' }, { roomCode:room.code, playerId, name:player.name, team:player.team });
}
function analyticsSummary() {
  recomputeTotalTimeSpent();
  const sessions = Object.values(analyticsDb.sessions);
  const users = Object.values(analyticsDb.users);
  const roomsList = Object.values(analyticsDb.rooms);
  const events = analyticsDb.events || [];
  const todayStart = startOfTodayMs();
  const activeStart = activeSinceMs();
  const sessionsToday = sessions.filter(s => Number(s.lastSeen || s.firstSeen || 0) >= todayStart);
  const activeSessions = sessions.filter(s => Number(s.lastSeen || 0) >= activeStart);
  const clickEvents = events.filter(e => e.type === 'click');
  const gameActions = events.filter(e => e.type === 'game_action');
  const roomJoinedEvents = events.filter(e => e.type === 'room_joined');
  const selectedTeamCounts = countBy(
    sessions.filter(s => s.team),
    s => s.team
  );
  const locationCounts = countBy(
    sessions,
    s => (s.country || 'Unknown') + (s.city ? ' / ' + s.city : '')
  );
  const roomsJoined = Math.max(roomJoinedEvents.length, Math.max(0, Number(analyticsDb.totals.roomJoins || 0) - Number(analyticsDb.totals.roomsCreated || 0)));
  const totalTimeMs = Number(analyticsDb.totals.timeSpentMs || 0);
  return {
    savedAt: analyticsDb.savedAt,
    totals: analyticsDb.totals,
    activeRooms: rooms.size,
    uniquePlayers: users.length,
    uniqueSessions: sessions.length,
    totalVisitorsToday: new Set(sessionsToday.map(s => s.visitorId || s.id)).size,
    activeUsersNow: new Set(activeSessions.map(s => s.visitorId || s.id)).size,
    totalSessions: sessions.length,
    averageTimeSpentMinutes: sessions.length ? Math.round(totalTimeMs / sessions.length / 60000) : 0,
    roomsCreated: Number(analyticsDb.totals.roomsCreated || 0),
    roomsJoined,
    matchesSimulated: gameActions.filter(e => e.label === 'simulate_match' || e.label === 'match_simulated').length,
    auctionCompletions: gameActions.filter(e => e.label === 'auction_completed').length,
    mostClickedButtons: topCounts(countBy(clickEvents, e => e.label || e.screen || 'Unknown'), 12),
    mostSelectedTeams: topCounts(selectedTeamCounts, 10),
    deviceTypes: topCounts(countBy(sessions, s => s.deviceType || 'Unknown'), 5),
    locations: topCounts(locationCounts, 10),
    totalTimeMinutes: Math.round((analyticsDb.totals.timeSpentMs || 0) / 60000),
    recentRooms: roomsList.sort((a,b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0)).slice(0, 20),
    recentEvents: analyticsDb.events.slice(-50)
  };
}
function canViewAnalytics(query) {
  if (!ANALYTICS_ADMIN_TOKEN) return process.env.NODE_ENV !== 'production';
  return String(query.token || '') === ANALYTICS_ADMIN_TOKEN;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 15_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
function checkRate(req, res, key, limit = 40, windowMs = 10_000) {
  const bucketKey = clientIp(req) + ':' + key;
  const t = now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, resetAt: t + windowMs };
  if (t > bucket.resetAt) { bucket.count = 0; bucket.resetAt = t + windowMs; }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  if (bucket.count > limit) {
    sendJson(res, 429, { error: 'Too many requests. Please wait a few seconds and try again.' });
    return false;
  }
  return true;
}
function isPlayerConnected(code, playerId) {
  for (const client of clients.get(code) || []) if (client.playerId === playerId) return true;
  return false;
}
function touchPlayer(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (player) { player.lastSeen = now(); touchRoom(room); }
}
function maybeTransferHost(room) {
  const host = room.players.find(p => p.id === room.creatorId);
  if (!host) {
    if (room.players[0]) room.creatorId = room.players[0].id;
    return;
  }
  if (isPlayerConnected(room.code, host.id)) return;
  const stale = now() - Number(host.lastSeen || room.createdAt || 0) > HOST_TIMEOUT_MS;
  if (!stale) return;
  const nextHost = room.players.find(p => p.id !== host.id && isPlayerConnected(room.code, p.id)) || room.players.find(p => p.id !== host.id);
  if (nextHost) {
    room.creatorId = nextHost.id;
    touchRoom(room);
  }
}
function publicRoom(room) {
  maybeTransferHost(room);
  return {
    code: room.code,
    creatorId: room.creatorId,
    started: !!room.started,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt || room.createdAt,
    players: room.players.map(p => ({ id: p.id, name: p.name, team: p.team, connected: isPlayerConnected(room.code, p.id), lastSeen: p.lastSeen || 0 })),
    game: room.game || null,
    gameRevision: room.gameRevision || 0,
    lastActionId: room.lastActionId || 0
  };
}
function roomForPlayer(room, playerId) {
  const data = publicRoom(room);
  const player = room.players.find(p => p.id === playerId);
  if (player) data.sessionToken = player.sessionToken;
  return data;
}
function broadcast(code) {
  const room = rooms.get(code);
  if (!room) return;
  const payload = `data: ${JSON.stringify(publicRoom(room))}\n\n`;
  for (const client of clients.get(code) || []) client.res.write(payload);
}
function roomCodeForTeam(team) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const idx = Math.max(0, TEAM_NAMES.indexOf(team));
  let code = '';
  do {
    code = String(idx) + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function assertTeamAvailable(room, team, playerId) {
  if (!TEAM_NAMES.includes(team)) throw new Error('Valid UCM team is required');
  const taken = room.players.find(p => p.team === team && p.id !== playerId);
  if (taken) throw new Error(`${team} is already selected by ${taken.name}`);
}
function assertRoomPlayer(room, playerId, token) {
  const player = room.players.find(p => p.id === String(playerId || '').trim());
  if (!player) throw new Error('Player is not in this room');
  if (!player.sessionToken || player.sessionToken !== String(token || '').trim()) throw new Error('Invalid player session. Rejoin the room and try again.');
  player.lastSeen = now();
  touchRoom(room);
  return player;
}
function currentPhase(room) {
  return (room.game && room.game.stage) || (room.started ? 'auction' : 'lobby');
}
function validateActionForPhase(room, type) {
  const phase = currentPhase(room);
  if (!ALLOWED_ACTIONS.has(type)) throw new Error('Unsupported multiplayer action');
  if (['bid', 'pass'].includes(type) && phase !== 'auction') throw new Error('Auction action is only allowed during auction.');
  if (type === 'xi' && phase !== 'xi') throw new Error('Playing XI can only be submitted during XI selection.');
  if (['simulateMatch', 'nextMatch'].includes(type) && phase !== 'match') throw new Error('Match action is only allowed during match simulation.');
}
function validateXiPayload(payload) {
  const xiIds = Array.isArray(payload.xiIds) ? payload.xiIds.filter(Boolean) : [];
  if (xiIds.length !== 11) throw new Error('Invalid playing XI. Exactly 11 players are required.');
  if (new Set(xiIds).size !== 11) throw new Error('Invalid playing XI. Duplicate players are not allowed.');
  if (!payload.captainId || !payload.viceCaptainId) throw new Error('Captain and vice-captain are required.');
  if (payload.captainId === payload.viceCaptainId) throw new Error('Captain and vice-captain cannot be the same player.');
  if (!xiIds.includes(payload.captainId) || !xiIds.includes(payload.viceCaptainId)) throw new Error('Captain and vice-captain must be in the XI.');
}
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
    '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml'
  }[ext] || 'application/octet-stream';
}
function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(requested)));
  if (!filePath.startsWith(ROOT)) return sendJson(res, 403, { error:'Forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error:'Not found' });
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control':'no-store' });
    res.end(data);
  });
}
async function handleApi(req, res, pathname, query) {
  if (pathname === '/api/analytics/event' && req.method === 'POST') {
    if (!checkRate(req, res, 'analytics-event', 240, 60_000)) return;
    const body = await readBody(req);
    let trusted = {};
    const roomCode = normalizeCode(body.roomCode || '');
    if (roomCode && rooms.has(roomCode) && body.playerId) {
      const room = rooms.get(roomCode);
      try {
        const player = assertRoomPlayer(room, body.playerId, body.sessionToken);
        trusted = { roomCode:room.code, playerId:player.id, name:player.name, team:player.team };
      } catch (e) {
        trusted = { roomCode };
      }
    }
    const event = recordAnalyticsEvent(req, body, trusted);
    return sendJson(res, 201, { ok:true, eventId:event.id });
  }
  if (pathname === '/api/analytics/summary' && req.method === 'GET') {
    if (!canViewAnalytics(query)) return sendJson(res, 403, { error:'Analytics token required' });
    return sendJson(res, 200, analyticsSummary());
  }
  const match = pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|leave|start|events|game|actions))?$/);
  if (req.method === 'POST' && pathname === '/api/rooms') {
    if (!checkRate(req, res, 'create-room', 8, 60_000)) return;
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 24);
    const team = String(body.team || '').trim();
    const playerId = String(body.playerId || '').trim() || makePlayerId();
    if (!name) return sendJson(res, 400, { error:'Player name is required' });
    if (!TEAM_NAMES.includes(team)) return sendJson(res, 400, { error:'Valid UCM team is required' });
    const code = body.code && validCode(body.code) && !rooms.has(normalizeCode(body.code)) ? normalizeCode(body.code) : roomCodeForTeam(team);
    const room = {
      code,
      creatorId: playerId,
      started: false,
      createdAt: now(),
      updatedAt: now(),
      players: [{ id: playerId, name, team, sessionToken: makeToken(), lastSeen: now() }],
      game: null,
      gameRevision: 0,
      actions: [],
      lastActionId: 0
    };
    rooms.set(code, room);
    recordRoomJoinAnalytics(req, room, playerId, 'create', body);
    saveRooms();
    saveAnalytics();
    broadcast(code);
    return sendJson(res, 201, roomForPlayer(room, playerId));
  }
  if (!match) return sendJson(res, 404, { error:'API route not found' });
  const code = normalizeCode(match[1]);
  const action = match[2];
  const room = rooms.get(code);
  if (!room) return sendJson(res, 404, { error:'Room not found on this server' });

  if (req.method === 'GET' && !action) {
    if (query.playerId) touchPlayer(room, String(query.playerId));
    return sendJson(res, 200, publicRoom(room));
  }
  if (req.method === 'GET' && action === 'events') {
    const playerId = String(query.playerId || '').trim();
    if (playerId) touchPlayer(room, playerId);
    res.writeHead(200, {
      'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive',
      'Access-Control-Allow-Origin':'*'
    });
    res.write(`data: ${JSON.stringify(publicRoom(room))}\n\n`);
    const client = { res, playerId };
    const ping = setInterval(() => {
      if (playerId) touchPlayer(room, playerId);
      res.write(': ping\n\n');
    }, 15000);
    if (!clients.has(code)) clients.set(code, new Set());
    clients.get(code).add(client);
    req.on('close', () => { clearInterval(ping); clients.get(code)?.delete(client); broadcast(code); });
    return;
  }
  if (req.method === 'POST' && action === 'join') {
    if (!checkRate(req, res, 'join-room', 20, 60_000)) return;
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 24);
    const team = String(body.team || '').trim();
    const playerId = String(body.playerId || '').trim() || makePlayerId();
    if (room.started) return sendJson(res, 409, { error:'This room has already started' });
    if (!name) return sendJson(res, 400, { error:'Player name is required' });
    assertTeamAvailable(room, team, playerId);
    room.players = room.players.filter(p => p.id !== playerId);
    room.players.push({ id: playerId, name, team, sessionToken: makeToken(), lastSeen: now() });
    recordRoomJoinAnalytics(req, room, playerId, 'join', body);
    touchRoom(room);
    saveRooms();
    saveAnalytics();
    broadcast(code);
    return sendJson(res, 200, roomForPlayer(room, playerId));
  }
  if (req.method === 'POST' && action === 'leave') {
    if (!checkRate(req, res, 'leave-room', 30, 60_000)) return;
    const body = await readBody(req);
    const player = assertRoomPlayer(room, body.playerId, body.sessionToken);
    recordAnalyticsEvent(req, body, { type:'room_left', roomCode:room.code, playerId:player.id, name:player.name, team:player.team });
    analyticsDb.totals.leaves += 1;
    if (player.id !== room.creatorId && !room.started) room.players = room.players.filter(p => p.id !== player.id);
    maybeTransferHost(room);
    touchRoom(room);
    saveRooms();
    broadcast(code);
    return sendJson(res, 200, publicRoom(room));
  }
  if (req.method === 'POST' && action === 'start') {
    if (!checkRate(req, res, 'start-room', 20, 60_000)) return;
    const body = await readBody(req);
    const player = assertRoomPlayer(room, body.playerId, body.sessionToken);
    maybeTransferHost(room);
    if (player.id !== room.creatorId) return sendJson(res, 403, { error:'Only the host can start' });
    if (room.players.length < 2) return sendJson(res, 400, { error:'At least 2 players must join before starting' });
    room.started = true;
    const analyticsRoom = ensureAnalyticsRoom(room.code);
    analyticsRoom.starts += 1;
    analyticsDb.totals.starts += 1;
    recordAnalyticsEvent(req, body, { type:'room_started', roomCode:room.code, playerId:player.id, name:player.name, team:player.team });
    touchRoom(room);
    saveRooms();
    broadcast(code);
    return sendJson(res, 200, publicRoom(room));
  }
  if (action === 'game') {
    if (req.method === 'GET') return sendJson(res, 200, { game: room.game || null, gameRevision: room.gameRevision || 0 });
    if (req.method === 'POST') {
      if (!checkRate(req, res, 'publish-game', 80, 10_000)) return;
      const body = await readBody(req);
      const player = assertRoomPlayer(room, body.playerId, body.sessionToken);
      maybeTransferHost(room);
      if (player.id !== room.creatorId) return sendJson(res, 403, { error:'Only the host can publish game state' });
      const stage = String((body.game && body.game.stage) || currentPhase(room));
      if (!['auction', 'xi', 'match', 'done'].includes(stage)) return sendJson(res, 400, { error:'Invalid game phase' });
      room.gameRevision = (room.gameRevision || 0) + 1;
      room.game = { ...(body.game || {}), stage, revision: room.gameRevision, updatedAt: now() };
      touchRoom(room);
      saveRooms();
      broadcast(code);
      return sendJson(res, 200, publicRoom(room));
    }
  }
  if (action === 'actions') {
    if (req.method === 'GET') {
      const since = Number(query.since || 0);
      return sendJson(res, 200, { actions: room.actions.filter(a => a.id > since), lastActionId: room.lastActionId || 0 });
    }
    if (req.method === 'POST') {
      if (!checkRate(req, res, 'room-action', 120, 10_000)) return;
      const body = await readBody(req);
      const player = assertRoomPlayer(room, body.playerId, body.sessionToken);
      const type = String(body.type || '').trim();
      const payload = body.payload || {};
      validateActionForPhase(room, type);
      if (type === 'xi') validateXiPayload(payload);
      const entry = {
        id: (room.lastActionId || 0) + 1,
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        type,
        payload,
        at: now()
      };
      room.lastActionId = entry.id;
      room.actions.push(entry);
      if (room.actions.length > 800) room.actions = room.actions.slice(-500);
      touchRoom(room);
      saveRooms();
      broadcast(code);
      return sendJson(res, 201, { action: entry, lastActionId: room.lastActionId });
    }
  }
  return sendJson(res, 405, { error:'Method not allowed' });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  if (pathname === '/healthz') {
    return sendJson(res, 200, { ok:true, service:'ucm-franchise-manager', rooms:rooms.size, analyticsEvents:analyticsDb.totals.events || 0 });
  }
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsed.query || {}).catch(err => sendJson(res, 400, { error:err.message || 'Request failed' }));
  } else {
    serveStatic(req, res, pathname);
  }
});
server.listen(PORT, HOST, () => {
  console.log(`UCM multiplayer server running on http://${HOST}:${PORT}`);
  console.log('In production, share the hosted HTTPS URL with every player.');
});
process.on('SIGINT', () => { saveRooms(); saveAnalytics(); process.exit(0); });
process.on('SIGTERM', () => { saveRooms(); saveAnalytics(); process.exit(0); });
