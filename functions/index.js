const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const secretSheetId = defineSecret('GOOGLE_SHEET_ID');
const secretSAEmail = defineSecret('GOOGLE_SERVICE_ACCOUNT_EMAIL');
const secretSAKey = defineSecret('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'us-central1' });

// Admin emails - must match frontend config
const ADMIN_EMAILS = ['kavinagrawal20@gmail.com', 's.manit.bhasin@fountainheadschools.org', 's.vardhan.bhotra@fountainheadschools.org'];
const STARTING_BALANCE = 100000;
const FINNHUB_API_KEY = 'd6omf4pr01qi5kh3go90d6omf4pr01qi5kh3go9g';

// Sanitize a name into a valid sheet tab name (max 100 chars, no special chars)
function toTabName(name) {
  return (name || 'Unknown').replace(/[\\\/\?\*\[\]]/g, '').slice(0, 100).trim() || 'Unknown';
}

async function appendTradeToGoogleSheet(trade) {
  const sheetId = secretSheetId.value();
  const saEmail = secretSAEmail.value();
  const saKey = secretSAKey.value();
  if (!sheetId || !saEmail || !saKey) {
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: saEmail,
      private_key: saKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Use the trader's display name as the tab; fall back to their email prefix
  const tabName = toTabName(trade.traderName || trade.userEmail?.split('@')[0] || 'Unknown');

  // Fetch the spreadsheet to see if a tab for this trader already exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTabs = spreadsheet.data.sheets.map(s => s.properties.title);

  if (!existingTabs.includes(tabName)) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Timestamp', 'Email', 'Action', 'Symbol', 'Shares', 'Price per Share', 'Total Value', 'Cash After', 'Net Worth After']],
      },
    });
  }

  // Append the trade row
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${tabName}'!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        trade.userEmail || '',
        trade.buyOrSell,
        trade.ticker,
        trade.quantity,
        trade.price,
        trade.totalValue,
        trade.cashAfterTrade,
        trade.netWorthAfterTrade,
      ]],
    },
  });
}

// ─── Market Hours Check ─────────────────────────────────────────────────────
function isMarketOpen() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const timeMin = ist.getHours() * 60 + ist.getMinutes();

  const inLateSession = timeMin >= 19 * 60; // 7:00 PM onward
  const inEarlySession = timeMin < 1 * 60 + 30; // until 1:30 AM

  // Mon-Thu: allow evening and overnight tail
  if (day >= 1 && day <= 4) return inLateSession || inEarlySession;
  // Fri: evening session only
  if (day === 5) return inLateSession;
  // Sat: only overnight tail from Friday session
  if (day === 6) return inEarlySession;
  // Sun: closed
  return false;
}

// ─── Fetch current stock price from Finnhub ──────────────────────────────────
async function fetchStockPrice(ticker) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
  const data = await res.json();
  if (!data.c || data.c === 0) throw new Error('Invalid stock price received');
  return data.c; // current price
}

// ─── executeTrade ────────────────────────────────────────────────────────────
exports.executeTrade = onCall({ secrets: [secretSheetId, secretSAEmail, secretSAKey] }, async (request) => {
  const { auth, data } = request;

  // Auth check
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  // Market hours check
  if (!isMarketOpen()) {
    throw new HttpsError('failed-precondition', 'Market is currently closed. Trading is only allowed 7:00 PM - 1:30 AM IST (Mon-Fri session).');
  }

  const { ticker, buyOrSell, quantity } = data;

  // Input validation
  if (!ticker || typeof ticker !== 'string' || ticker.length > 10) {
    throw new HttpsError('invalid-argument', 'Invalid ticker');
  }
  if (buyOrSell !== 'BUY' && buyOrSell !== 'SELL') {
    throw new HttpsError('invalid-argument', 'buyOrSell must be BUY or SELL');
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) {
    throw new HttpsError('invalid-argument', 'Quantity must be a positive integer');
  }

  const userId = auth.uid;
  const userRef = db.collection('users').doc(userId);

  // Run in transaction for atomicity
  const result = await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');

    const userDoc = userSnap.data();
    const ticker_upper = ticker.toUpperCase();

    // Fetch live price server-side (cannot trust client)
    const price = await fetchStockPrice(ticker_upper);
    const totalValue = price * quantity;

    let newCashBalance;
    let newPortfolio = [...(userDoc.portfolio || [])];

    if (buyOrSell === 'BUY') {
      // Check sufficient funds
      if (userDoc.cashBalance < totalValue) {
        throw new HttpsError('failed-precondition',
          `Insufficient funds. Need ${totalValue.toFixed(2)}, have ${userDoc.cashBalance.toFixed(2)}`);
      }
      newCashBalance = userDoc.cashBalance - totalValue;

      // Update portfolio
      const existingIdx = newPortfolio.findIndex(p => p.symbol === ticker_upper);
      if (existingIdx >= 0) {
        const existing = newPortfolio[existingIdx];
        const totalShares = existing.shares + quantity;
        const newAvgPrice = ((existing.avgPrice * existing.shares) + (price * quantity)) / totalShares;
        newPortfolio[existingIdx] = { ...existing, shares: totalShares, avgPrice: newAvgPrice };
      } else {
        newPortfolio.push({ symbol: ticker_upper, shares: quantity, avgPrice: price });
      }
    } else {
      // SELL
      const posIdx = newPortfolio.findIndex(p => p.symbol === ticker_upper);
      if (posIdx < 0) throw new HttpsError('failed-precondition', 'You do not own this stock');
      if (newPortfolio[posIdx].shares < quantity) {
        throw new HttpsError('failed-precondition',
          `Cannot sell ${quantity} shares, you only own ${newPortfolio[posIdx].shares}`);
      }

      newCashBalance = userDoc.cashBalance + totalValue;
      const remaining = newPortfolio[posIdx].shares - quantity;
      if (remaining === 0) {
        newPortfolio.splice(posIdx, 1);
      } else {
        newPortfolio[posIdx] = { ...newPortfolio[posIdx], shares: remaining };
      }
    }

    // Calculate new portfolio value and net worth
    const portfolioValue = newPortfolio.reduce((sum, pos) => {
      // Use the current price we fetched for the traded stock; others remain as-is
      // For a precise net worth, we sum currentValue from portfolio (which triggers separate calls)
      // Here we compute conservatively using stored avgPrice for other positions
      return sum + pos.shares * pos.avgPrice;
    }, 0);
    const newNetWorth = newCashBalance + portfolioValue;

    // Update user document
    transaction.update(userRef, {
      cashBalance: newCashBalance,
      portfolio: newPortfolio,
      netWorth: newNetWorth,
      portfolioValue: portfolioValue,
      totalTrades: admin.firestore.FieldValue.increment(1),
    });

    // Create trade record
    const tradeRef = db.collection('trades').doc();
    transaction.set(tradeRef, {
      userId,
      userEmail: userDoc.email,
      teamName: userDoc.teamName || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ticker: ticker_upper,
      buyOrSell,
      quantity,
      price,
      totalValue,
      cashAfterTrade: newCashBalance,
      netWorthAfterTrade: newNetWorth,
    });

    return {
      success: true,
      ticker: ticker_upper,
      buyOrSell,
      quantity,
      price,
      totalValue,
      newCashBalance,
      userEmail: userDoc.email || '',
      teamName: userDoc.teamName || '',
      netWorthAfterTrade: newNetWorth,
    };
  });

  // Best-effort Google Sheets logging for audit trail.
  try {
    await appendTradeToGoogleSheet({
      userEmail: result.userEmail,
      traderName: result.teamName,
      ticker: result.ticker,
      buyOrSell: result.buyOrSell,
      quantity: result.quantity,
      price: result.price,
      totalValue: result.totalValue,
      cashAfterTrade: result.newCashBalance,
      netWorthAfterTrade: result.netWorthAfterTrade,
    });
  } catch (err) {
    console.error('Google Sheets append failed:', err.message);
  }

  return result;
});

// ─── adminResetCompetition ───────────────────────────────────────────────────
exports.adminResetCompetition = onCall(async (request) => {
  const { auth } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  // Verify admin
  const userSnap = await db.collection('users').doc(auth.uid).get();
  if (!userSnap.exists || !ADMIN_EMAILS.includes(userSnap.data().email)) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }

  // Reset all users
  const usersSnap = await db.collection('users').get();
  const batch = db.batch();
  usersSnap.docs.forEach(d => {
    batch.update(d.ref, {
      cashBalance: STARTING_BALANCE,
      netWorth: STARTING_BALANCE,
      portfolioValue: 0,
      portfolio: [],
      totalTrades: 0,
    });
  });
  await batch.commit();

  // Delete all trades in batches
  const tradesSnap = await db.collection('trades').get();
  const tradeBatches = [];
  let currentBatch = db.batch();
  let opCount = 0;
  tradesSnap.docs.forEach(d => {
    currentBatch.delete(d.ref);
    opCount++;
    if (opCount === 400) {
      tradeBatches.push(currentBatch);
      currentBatch = db.batch();
      opCount = 0;
    }
  });
  if (opCount > 0) tradeBatches.push(currentBatch);
  await Promise.all(tradeBatches.map(b => b.commit()));

  // Delete portfolio snapshots
  const snapsSnap = await db.collection('portfolioSnapshots').get();
  const snapBatches = [];
  let snapBatch = db.batch();
  let snapCount = 0;
  snapsSnap.docs.forEach(d => {
    snapBatch.delete(d.ref);
    snapCount++;
    if (snapCount === 400) {
      snapBatches.push(snapBatch);
      snapBatch = db.batch();
      snapCount = 0;
    }
  });
  if (snapCount > 0) snapBatches.push(snapBatch);
  await Promise.all(snapBatches.map(b => b.commit()));

  return { success: true, message: 'Competition reset complete' };
});

// ─── adminResetUser ──────────────────────────────────────────────────────────
exports.adminResetUser = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const callerSnap = await db.collection('users').doc(auth.uid).get();
  if (!callerSnap.exists || !ADMIN_EMAILS.includes(callerSnap.data().email)) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }

  const { targetUserId } = data;
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId required');

  await db.collection('users').doc(targetUserId).update({
    cashBalance: STARTING_BALANCE,
    netWorth: STARTING_BALANCE,
    portfolioValue: 0,
    portfolio: [],
    totalTrades: 0,
  });

  // Delete user's trades
  const tradesSnap = await db.collection('trades').where('userId', '==', targetUserId).get();
  const batch = db.batch();
  tradesSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  return { success: true };
});

// ─── Daily Portfolio Snapshot (runs at 4:05 PM ET on weekdays) ──────────────
exports.dailyPortfolioSnapshot = onSchedule(
  { schedule: '5 21 * * 1-5', timeZone: 'UTC' }, // 4:05 PM ET = 21:05 UTC
  async (event) => {
    const usersSnap = await db.collection('users').get();
    const today = new Date().toISOString().slice(0, 10);
    const batch = db.batch();

    usersSnap.docs.forEach(d => {
      const userData = d.data();
      const snapshotRef = db.collection('portfolioSnapshots').doc();
      batch.set(snapshotRef, {
        userId: d.id,
        date: today,
        cashBalance: userData.cashBalance || 0,
        portfolioValue: userData.portfolioValue || 0,
        netWorth: userData.netWorth || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Portfolio snapshots created for ${usersSnap.size} users on ${today}`);
  }
);

// Legacy compatibility function kept to avoid scheduler deletion errors on this project.
exports.processPendingTransactions = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'UTC' },
  async () => {
    return;
  }
);
