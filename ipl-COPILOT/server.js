const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const TEAM_NAMES = [
  'Mumbai Indians', 'Chennai Super Kings', 'Royal Challengers Bangalore', 'Kolkata Knight Riders', 'Delhi Capitals',
  'Sunrisers Hyderabad', 'Rajasthan Royals', 'Punjab Kings', 'Gujarat Titans', 'Lucknow Super Giants'
];
const rooms = new Map();
const clients = new Map();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
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
function publicRoom(room) {
  return {
    code: room.code,
    creatorId: room.creatorId,
    started: !!room.started,
    createdAt: room.createdAt,
    players: room.players.map(p => ({ id:p.id, name:p.name, team:p.team })),
    game: room.game || null,
    gameRevision: room.gameRevision || 0,
    lastActionId: room.lastActionId || 0
  };
}
function broadcast(code) {
  const room = rooms.get(code);
  if (!room) return;
  const payload = `data: ${JSON.stringify(publicRoom(room))}\n\n`;
  for (const res of clients.get(code) || []) res.write(payload);
}
function roomCodeForTeam(team) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const idx = Math.max(0, TEAM_NAMES.indexOf(team));
  let code = '';
  do {
    code = String(idx) + Array.from({ length:5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function assertTeamAvailable(room, team, playerId) {
  if (!TEAM_NAMES.includes(team)) throw new Error('Unknown team');
  const taken = room.players.find(p => p.team === team && p.id !== playerId);
  if (taken) throw new Error(`${team} is already selected by ${taken.name}`);
}
function assertRoomPlayer(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) throw new Error('Player is not in this room');
  return player;
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
  const match = pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|leave|start|events|game|actions))?$/);
  if (req.method === 'POST' && pathname === '/api/rooms') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 24);
    const team = String(body.team || '').trim();
    const playerId = String(body.playerId || '').trim() || `P${Date.now()}`;
    if (!name) return sendJson(res, 400, { error:'Player name is required' });
    if (!TEAM_NAMES.includes(team)) return sendJson(res, 400, { error:'Valid team is required' });
    const code = body.code && /^[0-9A-Z]{6}$/.test(String(body.code)) && !rooms.has(String(body.code)) ? String(body.code) : roomCodeForTeam(team);
    const room = { code, creatorId:playerId, started:false, createdAt:Date.now(), players:[{ id:playerId, name, team }], game:null, gameRevision:0, actions:[], lastActionId:0 };
    rooms.set(code, room);
    broadcast(code);
    return sendJson(res, 201, publicRoom(room));
  }
  if (!match) return sendJson(res, 404, { error:'API route not found' });
  const code = match[1];
  const action = match[2];
  const room = rooms.get(code);
  if (!room) return sendJson(res, 404, { error:'Room not found on this server' });
  if (req.method === 'GET' && !action) return sendJson(res, 200, publicRoom(room));
  if (req.method === 'GET' && action === 'events') {
    res.writeHead(200, {
      'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive',
      'Access-Control-Allow-Origin':'*'
    });
    res.write(`data: ${JSON.stringify(publicRoom(room))}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    if (!clients.has(code)) clients.set(code, new Set());
    clients.get(code).add(res);
    req.on('close', () => { clearInterval(ping); clients.get(code)?.delete(res); });
    return;
  }
  if (req.method === 'POST' && action === 'join') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 24);
    const team = String(body.team || '').trim();
    const playerId = String(body.playerId || '').trim() || `P${Date.now()}`;
    if (room.started) return sendJson(res, 409, { error:'This room has already started' });
    if (!name) return sendJson(res, 400, { error:'Player name is required' });
    assertTeamAvailable(room, team, playerId);
    room.players = room.players.filter(p => p.id !== playerId);
    room.players.push({ id:playerId, name, team });
    broadcast(code);
    return sendJson(res, 200, publicRoom(room));
  }
  if (req.method === 'POST' && action === 'leave') {
    const body = await readBody(req);
    const playerId = String(body.playerId || '').trim();
    if (playerId && playerId !== room.creatorId && !room.started) room.players = room.players.filter(p => p.id !== playerId);
    broadcast(code);
    return sendJson(res, 200, publicRoom(room));
  }
  if (req.method === 'POST' && action === 'start') {
    const body = await readBody(req);
    if (String(body.playerId || '') !== room.creatorId) return sendJson(res, 403, { error:'Only the room creator can start' });
    if (room.players.length < 2) return sendJson(res, 400, { error:'At least 2 players must join before starting' });
    room.started = true;
    broadcast(code);
    return sendJson(res, 200, publicRoom(room));
  }
  if (action === 'game') {
    if (req.method === 'GET') return sendJson(res, 200, { game: room.game || null, gameRevision: room.gameRevision || 0 });
    if (req.method === 'POST') {
      const body = await readBody(req);
      const playerId = String(body.playerId || '').trim();
      if (playerId !== room.creatorId) return sendJson(res, 403, { error:'Only the room creator can publish game state' });
      room.gameRevision = (room.gameRevision || 0) + 1;
      room.game = { ...(body.game || {}), revision: room.gameRevision, updatedAt: Date.now() };
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
      const body = await readBody(req);
      const playerId = String(body.playerId || '').trim();
      const player = assertRoomPlayer(room, playerId);
      const type = String(body.type || '').trim();
      if (!type) return sendJson(res, 400, { error:'Action type is required' });
      const entry = {
        id: (room.lastActionId || 0) + 1,
        playerId,
        playerName: player.name,
        team: player.team,
        type,
        payload: body.payload || {},
        at: Date.now()
      };
      room.lastActionId = entry.id;
      room.actions.push(entry);
      if (room.actions.length > 800) room.actions = room.actions.slice(-500);
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
    return sendJson(res, 200, { ok:true, service:'ucm-franchise-manager' });
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
