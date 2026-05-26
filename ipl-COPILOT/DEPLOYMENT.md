# UCM Franchise Manager - Online Multiplayer Hosting

This is not a static-only website. Multiplayer rooms need the Node server in server.js.

## Start command

Use this command on any hosting platform:

```bash
npm start
```

The platform will set PORT automatically. The server serves the game page, player database, stats DB, room APIs, room events, and game sync from one URL.

## Important multiplayer rule

All players must open the exact same hosted URL, for example:

```text
https://your-app-name.onrender.com
```

Do not host the HTML as a static site separately. If users open separate static copies, rooms cannot sync.

## Render quick setup

1. Push this folder to GitHub.
2. Create a new Render Web Service.
3. Select the GitHub repo.
4. Build command: `npm install`
5. Start command: `npm start`
6. Open the Render URL and share that same URL with friends.

## Current storage

Rooms are kept in server memory. If the server restarts or sleeps, active rooms reset. For permanent online leagues later, move rooms/game state to Redis, Supabase, Firebase, or another database.
