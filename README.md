# TradeSim Final

A school stock-market competition web app built with React + Firebase.

Students can sign in, trade with virtual cash, track portfolio performance, and compete on a leaderboard. Admin users can reset the competition or individual users.

## Tech Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Recharts, lightweight-charts
- Backend: Firebase Cloud Functions (2nd gen, Node.js 22)
- Database/Auth: Firestore + Firebase Authentication (Google sign-in)
- Hosting: Firebase Hosting
- Market Data: Finnhub API

## Features

- Google sign-in authentication
- Protected app routes
- Live quote lookup and stock pages
- Buy/sell trade execution via callable Cloud Function
- Server-side trade validation and market-hours checks
- Portfolio, watchlist, and trade history views
- Leaderboard based on net worth
- Admin-only reset tools
- Daily portfolio snapshot scheduler
- Optional Google Sheets trade audit logging from Cloud Functions

## Project Structure

- `src/`: React app (pages, components, contexts, Firebase client config)
- `functions/`: Firebase Cloud Functions backend
- `firestore.rules`: Firestore security rules
- `firestore.indexes.json`: Firestore indexes
- `firebase.json`: Firebase hosting/functions/firestore config
- `deploy.ps1`: PowerShell deployment helper
- `SETUP.md`: Expanded setup/deployment walkthrough

## Prerequisites

- Node.js 22+ recommended
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project on Blaze plan (required for Cloud Functions and schedulers)
- Finnhub API key

## Environment Setup

1. Install dependencies:

```bash
npm install
cd functions && npm install && cd ..
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` with your Firebase web config and Finnhub key:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FINNHUB_API_KEY`

4. Set Firebase project alias in `.firebaserc`.

## Google Sheets Secrets (Cloud Functions)

The backend references these Firebase Functions secrets for Sheets audit logging:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Set them with:

```bash
firebase functions:secrets:set GOOGLE_SHEET_ID
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_EMAIL
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

If these secrets are not set, trade logging to Sheets is skipped safely.

## Run Locally

Start frontend dev server:

```bash
npm run dev
```

Useful backend command (from `functions/`):

```bash
npm run serve
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Deploy everything:

```bash
npm run deploy
```

Or deploy specific services:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore
```

PowerShell helper:

```powershell
./deploy.ps1
./deploy.ps1 -Target hosting
./deploy.ps1 -Target functions
./deploy.ps1 -Target firestore
```

## Cloud Functions

Defined in `functions/index.js`:

- `executeTrade` (callable): validates and executes BUY/SELL, updates user balances and portfolio, writes trade records, appends to Sheets (best effort)
- `syncMyNetWorth` (callable): recomputes and stores a user net worth
- `adminResetCompetition` (callable): resets all users and clears trade/snapshot collections (admin only)
- `adminResetUser` (callable): resets one user and clears their trades (admin only)
- `dailyPortfolioSnapshot` (scheduled): writes end-of-day snapshots on weekdays
- `processPendingTransactions` (scheduled): legacy no-op placeholder

## Firestore Data Model (High Level)

- `users/{userId}`: profile, cash balance, portfolio, net worth, watchlist, stats
- `trades/{tradeId}`: executed trades with price, quantity, and post-trade balances
- `portfolioSnapshots/{snapshotId}`: periodic user net worth snapshots

## Security Notes

- Client cannot directly write financial fields in `users` docs
- Trade writes are blocked from client; only Functions can create trades
- Admin behavior is protected by server-side admin email checks
- Keep API keys and secrets out of source code where possible

## Scripts

Root `package.json`:

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run deploy` - build + firebase deploy

Functions `package.json`:

- `npm run serve` - run Functions emulator
- `npm run shell` - Functions shell
- `npm run deploy` - deploy only functions
- `npm run logs` - view function logs

## Troubleshooting

- Deployment/setup details: see `SETUP.md`
- If deploy runs out of memory/time during function discovery, deploy in parts and use higher Node memory (see repository notes and existing scripts)

## License

No license file is currently included. Add one if you plan to open-source this project.
