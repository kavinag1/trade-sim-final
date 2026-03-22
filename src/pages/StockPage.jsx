import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getQuote, getCompanyProfile } from '../services/finnhub';
import { formatCurrency, formatPercent } from '../utils/market';
import TradePanel from '../components/trading/TradePanel';

export default function StockPage() {
  const { symbol } = useParams();
  const { user, userProfile, refreshProfile } = useAuth();
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    loadData();
  }, [symbol]);

  useEffect(() => {
    if (userProfile?.watchlist) {
      setInWatchlist(userProfile.watchlist.includes(symbol?.toUpperCase()));
    }
  }, [userProfile, symbol]);

  async function loadData() {
    setLoading(true);
    try {
      const [q, p] = await Promise.all([
        getQuote(symbol),
        getCompanyProfile(symbol),
      ]);
      setQuote(q);
      setProfile(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleWatchlist() {
    if (!user || watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      const ref = doc(db, 'users', user.uid);
      if (inWatchlist) {
        await updateDoc(ref, { watchlist: arrayRemove(symbol.toUpperCase()) });
        setInWatchlist(false);
      } else {
        await updateDoc(ref, { watchlist: arrayUnion(symbol.toUpperCase()) });
        setInWatchlist(true);
      }
      await refreshProfile();
    } finally {
      setWatchlistLoading(false);
    }
  }

  // Auto-refresh price every 30s during market hours
  useEffect(() => {
    const interval = setInterval(() => {
      getQuote(symbol).then(setQuote).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const sym = symbol?.toUpperCase();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            {profile?.logo && (
              <img src={profile.logo} alt={sym} className="w-10 h-10 rounded-lg object-contain bg-white p-1" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{profile?.name || sym}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-accent-blue font-semibold">{sym}</span>
                {profile?.exchange && <span className="text-gray-500 text-sm">· {profile.exchange}</span>}
                {profile?.finnhubIndustry && <span className="text-gray-500 text-sm">· {profile.finnhubIndustry}</span>}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={toggleWatchlist}
          disabled={watchlistLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            inWatchlist
              ? 'border-accent-gold/50 text-accent-gold hover:bg-accent-gold/10'
              : 'border-dark-500 text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          <svg className="w-4 h-4" fill={inWatchlist ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          {inWatchlist ? 'Watching' : 'Watch'}
        </button>
      </div>

      {/* Price */}
      {quote && (
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-4xl font-bold font-mono text-white">{formatCurrency(quote.price)}</span>
          <div className={`flex items-center gap-1 ${quote.changePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            <span className="font-mono text-lg font-semibold">{formatCurrency(quote.change)}</span>
            <span className="font-mono text-lg">({formatPercent(quote.changePercent)})</span>
            <span className="text-sm">today</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Stats + Company info */}
        <div className="xl:col-span-2 space-y-4">
          {/* Stats */}
          {quote && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Open', value: formatCurrency(quote.open) },
                { label: 'Prev Close', value: formatCurrency(quote.previousClose) },
                { label: 'Day High', value: formatCurrency(quote.high) },
                { label: 'Day Low', value: formatCurrency(quote.low) },
              ].map(({ label, value }) => (
                <div key={label} className="card py-3">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="font-mono font-semibold mt-1">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Company info */}
          {profile && (
            <div className="card">
              <h3 className="font-semibold text-white mb-3">Company Info</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Market Cap', value: profile.marketCapitalization ? `$${(profile.marketCapitalization / 1000).toFixed(1)}B` : '—' },
                  { label: 'IPO Date', value: profile.ipo || '—' },
                  { label: 'Country', value: profile.country || '—' },
                  { label: 'Currency', value: profile.currency || '—' },
                  { label: 'Shares Outstanding', value: profile.shareOutstanding ? `${profile.shareOutstanding.toFixed(0)}M` : '—' },
                  { label: 'Website', value: profile.weburl ? (
                    <a href={profile.weburl} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline truncate block">
                      {profile.weburl.replace('https://', '')}
                    </a>
                  ) : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-gray-500 text-xs">{label}</div>
                    <div className="font-medium mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trade panel */}
        <div className="space-y-4">
          <div className="card border border-accent-blue/30 bg-accent-blue/10">
            <h3 className="text-sm font-semibold text-white mb-2">How to buy 1 share</h3>
            <ol className="list-decimal list-inside text-sm text-gray-200 space-y-1">
              <li>Confirm the stock symbol and current price on this page.</li>
              <li>In the trade panel, keep action as BUY.</li>
              <li>Enter quantity as 1.</li>
              <li>Review your estimated total and submit the order.</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">
              Orders execute at live market price when the market is open.
            </p>
          </div>

          <TradePanel
            symbol={sym}
            currentPrice={quote?.price || 0}
            userPortfolio={userProfile?.portfolio || []}
          />
        </div>
      </div>
    </div>
  );
}
