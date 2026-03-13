import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '../services/finnhub';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const popularStocks = [
    { symbol: 'AAPL', description: 'Apple Inc.' },
    { symbol: 'MSFT', description: 'Microsoft Corporation' },
    { symbol: 'GOOGL', description: 'Alphabet Inc.' },
    { symbol: 'AMZN', description: 'Amazon.com Inc.' },
    { symbol: 'TSLA', description: 'Tesla Inc.' },
    { symbol: 'NVDA', description: 'NVIDIA Corporation' },
    { symbol: 'META', description: 'Meta Platforms Inc.' },
    { symbol: 'JPM', description: 'JPMorgan Chase & Co.' },
  ];

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchStocks(query.trim());
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Search Stocks</h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          className="input flex-1"
          placeholder="Search by ticker or company name (e.g. AAPL, Apple)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary px-6" disabled={loading}>
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Search'}
        </button>
      </form>

      {!searched && (
        <div>
          <p className="text-gray-500 text-sm mb-4">Popular stocks</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularStocks.map(({ symbol, description }) => (
              <button
                key={symbol}
                onClick={() => navigate(`/stock/${symbol}`)}
                className="card hover:border-accent-blue/50 transition-colors text-left p-4"
              >
                <div className="font-mono font-bold text-accent-blue text-lg">{symbol}</div>
                <div className="text-gray-400 text-xs mt-1 truncate">{description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No results found for "{query}"
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(r => (
            <button
              key={r.symbol}
              onClick={() => navigate(`/stock/${r.symbol}`)}
              className="w-full card hover:border-accent-blue/50 transition-colors text-left flex items-center justify-between"
            >
              <div>
                <div className="font-mono font-bold text-white">{r.symbol}</div>
                <div className="text-gray-400 text-sm">{r.description}</div>
              </div>
              <span className="text-gray-500 text-xs bg-dark-600 px-2 py-1 rounded">{r.type || 'Stock'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
