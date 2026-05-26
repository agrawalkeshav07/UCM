# UCM – Ultimate Cricket Manager

## Overview

UCM (Ultimate Cricket Manager) is a multiplayer cricket franchise simulation game inspired by T20 league cricket. Players become franchise owners, participate in live auctions, build squads, create match lineups, and compete in strategic tournaments using historical cricket performance data and realistic simulation logic.

Unlike traditional fantasy cricket games, UCM focuses on:

* Franchise management
* Strategic auctions
* Squad building
* Historical performance simulation
* Tactical batting order management
* Multiplayer competition

---

# Core Features

## 1. Multiplayer Franchise Ownership

* Up to 10 players in one tournament
* Each player controls one franchise
* Online room-based multiplayer system

---

## 2. Live Auction System

* Real-time multiplayer auction
* Dynamic bidding system
* Shared auction rooms
* Budget management
* Team locking system
* Minimum and maximum squad rules

### Auction Rules

* Base price for every player
* Team purse limit
* Minimum squad size
* Maximum squad size

---

## 3. Historical Match Simulation Engine

The game uses historical cricket match data to simulate realistic T20 matches.

### Match Simulation Logic

Before every match:

* A random historical season is selected
* Player performances are retrieved from corresponding historical matches
* Batting order affects scoring
* Teams are restricted to 120 balls

---

## 4. Advanced Batting Order Engine

The simulation uses:

* Historical runs
* Historical balls faced
* Batting position logic
* Strike-rate preservation
* Ball-consumption mechanics

### Key Features

* Maximum innings limit = 120 balls
* Batters consume balls sequentially
* Realistic innings scaling
* Batting-order strategy matters

---

## 5. Batting Position Penalty System

To prevent unrealistic batting-order exploits:

### Position Difference Penalty

| Difference | Multiplier |
| ---------- | ---------- |
| 0          | 1.00       |
| 1          | 0.90       |
| 2          | 0.75       |
| 3+         | 0.60       |

This prevents finishers from unrealistically dominating as openers.

---

## 6. Wicket Bonus System

Bowling contributions are converted into bonus impact points.

### Formula

```text
Wicket Bonus = Wickets × 25
```

These points are added separately from batting runs.

---

## 7. Tournament Structure

* Round robin league format
* Each team plays every other team twice
* Points table system
* Playoffs
* Finals

### Playoff Structure

* Semi Final 1
* Eliminator
* Semi Final 2
* Final

---

# Match Simulation Example

## Historical Stats

| Player | Runs | Balls |
| ------ | ---: | ----: |
| Kohli  |   40 |    30 |
| Rohit  |   70 |    60 |
| Dhawan |   60 |    40 |
| Jadeja |   31 |    12 |

## User Batting Order

1. Kohli
2. Jadeja
3. Dhawan
4. Rohit

## Simulation Output

* Kohli: 40
* Jadeja: 19 (position penalty applied)
* Dhawan: 60
* Rohit: 26 (limited balls remaining)

### Final Team Score

```text
145 runs + wicket bonus
```

---

# Tech Stack

## Frontend

* HTML
* CSS
* JavaScript

## Backend

* Node.js
* Express.js
* Socket.IO

## Database (Planned)

* Supabase / PostgreSQL
  or
* Firebase

---

# Multiplayer Features

* Private room creation
* Room code joining system
* Team locking
* Live auction synchronization
* Real-time room updates
* Host controls

---

# Planned Features

* AI franchise owners
* Player form system
* Injuries
* Weather conditions
* Pitch types
* Commentary engine
* Franchise progression
* Reward economy
* Mobile app support
* Seasonal tournaments
* Historical “What If” modes

---

# Legal & Branding

This game uses:

* Fictional tournament branding (UCM)
* Fictional franchise branding
* Historical statistical inspiration only

No official league branding, logos, or copyrighted media assets are included.

---

# Monetization Plan

* Cosmetic purchases
* Premium memberships
* Private tournament rooms
* Reward-based coin system
* Redeemable vouchers
* Sponsored tournaments

No direct cash withdrawal system is planned initially.

---

# Project Goal

The goal of UCM is to create:

* The most strategic cricket franchise simulator
* A highly replayable multiplayer experience
* A deep auction-based cricket management ecosystem
* A realistic yet fun cricket simulation engine

---

# Current Development Status

## Completed

* Core game idea
* Auction logic
* Match simulation foundation
* Multiplayer room architecture
* Batting-order engine design

## In Progress

* Multiplayer synchronization
* Team locking system
* Online auction system

## Planned

* Full historical database
* Mobile app conversion
* Scalable backend infrastructure

---

# Vision

UCM aims to become a unique cricket management universe where:

* Every auction matters
* Every batting order matters
* Every historical season creates new outcomes
* Every tournament tells a different story
