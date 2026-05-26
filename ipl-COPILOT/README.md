# UCM - Ultimate Cricket Manager

UCM is a fictional cricket franchise management simulation game. It includes solo play, multiplayer rooms, auction flow, squad management, match simulation, points tables, playoffs, and season stats.

## Legal Note

UCM is a fictional cricket management simulation game. It is not affiliated with, endorsed by, or connected to any real cricket league, cricket board, franchise, player, or official tournament.

Created with love by [Keshav](https://www.linkedin.com/in/keshav-agrawal-122b43159/).

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:8790
```

## Test

```bash
npm test
```

## Render Deployment

Use a Node Web Service.

If your GitHub repo root directly contains `package.json`, use:

```text
Build Command: npm install
Start Command: npm start
```

If your GitHub repo has this app inside a subfolder, set Render **Root Directory** to the subfolder that contains package.json, server.js, and index.html.

Then keep:

```text
Build Command: npm install
Start Command: npm start
```

## Multiplayer Storage

Rooms are persisted to `ucm_rooms_db.json` by default. This prevents normal restarts from immediately erasing rooms on the same server instance. For production-grade long-term multiplayer, move room storage to PostgreSQL using `DATABASE_URL`.
