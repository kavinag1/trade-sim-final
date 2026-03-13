# TradeSim — Setup & Deployment Guide

## What This Is
A fully featured school stock trading competition simulator with:
- Real stock data via Finnhub API
- Virtual $100,000 per user
- Real-time market hours enforcement (NYSE/NASDAQ)
- Firebase backend (Auth + Firestore + Cloud Functions + Hosting)
- Leaderboard, Portfolio, Trade History, Watchlist
- Admin panel for competition management

---

## Step 1: Create Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click "Create a project", name it (e.g., `trade-sim`)
3. Enable Google Analytics (optional)
4. After creation, go to **Project Settings > General**
5. Under "Your apps", click the Web icon `</>`
6. Register the app, name it `trade-sim-web`
7. Copy the `firebaseConfig` object — you'll need these values

---

## Step 2: Enable Firebase Services

### Authentication
- Firebase Console → Authentication → Get Started
- Enable **Google** sign-in provider
- Add your domain to authorized domains when deploying

### Firestore
- Firebase Console → Firestore → Create database
- Start in **production mode**
- Choose a region (e.g., `us-central1`)

### Cloud Functions
- Requires **Blaze (pay-as-you-go) plan** (free tier is very generous)
- Upgrade at: Firebase Console → Upgrade

---

## Step 3: Get Finnhub API Key

1. Go to [https://finnhub.io/register](https://finnhub.io/register)
2. Sign up for free
3. Your API key is on the dashboard

---

## Step 4: Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

VITE_FINNHUB_API_KEY=your_finnhub_key
```

---

## Step 5: Update Admin Emails

Edit `src/config.js` and add admin email addresses:

```js
export const ADMIN_EMAILS = [
  'your-admin@email.com',
];
```

Also update `functions/index.js` line:
```js
const ADMIN_EMAILS = ['your-admin@email.com'];
```

---

## Step 6: Update Firebase Project ID

Edit `.firebaserc`:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

---

## Step 7: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

---

## Step 8: Set Cloud Functions Environment Variables

```bash
firebase functions:secrets:set FINNHUB_API_KEY
# Enter your Finnhub API key when prompted
```

---

## Step 9: Deploy

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Build and deploy everything
npm run build
firebase deploy
```

Or deploy separately:
```bash
firebase deploy --only hosting    # Frontend only
firebase deploy --only functions  # Cloud functions only
firebase deploy --only firestore  # Firestore rules + indexes
```

---

## Step 10: After Deployment

1. Your site will be live at `https://your-project-id.web.app`
2. Go to Firebase Console → Authentication → Authorized Domains
3. Add your custom domain if you have one
4. Share the URL with students to start competing!

---

## Firestore Schema

### `users/{userId}`
```
userId: string
email: string
name: string
teamName: string
cashBalance: number  (starts at 100000)
netWorth: number
portfolioValue: number
portfolio: Array<{ symbol, shares, avgPrice }>
watchlist: string[]
totalTrades: number
createdAt: timestamp
```

### `trades/{tradeId}`
```
userId: string
userEmail: string
teamName: string
timestamp: timestamp
ticker: string
buyOrSell: "BUY" | "SELL"
quantity: number
price: number
totalValue: number
cashAfterTrade: number
netWorthAfterTrade: number
```

### `portfolioSnapshots/{snapshotId}`
```
userId: string
date: string (YYYY-MM-DD)
cashBalance: number
portfolioValue: number
netWorth: number
createdAt: timestamp
```

---

## Security Features
- All trades validated server-side via Cloud Functions
- Users cannot modify their own cash balance or portfolio via client
- Market hours enforced server-side
- Firestore security rules block client-side financial manipulation
- Admin functions require server-verified admin email

---

## Cloud Functions
- `executeTrade` — validates and executes buy/sell orders
- `adminResetCompetition` — resets all users (admin only)
- `adminResetUser` — resets a single user (admin only)
- `dailyPortfolioSnapshot` — runs at 4:05 PM ET Mon-Fri, saves snapshots
