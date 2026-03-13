import { createContext, useContext, useEffect, useState } from 'react';
import { getMarketStatus } from '../utils/market';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());

  useEffect(() => {
    const update = () => setMarketStatus(getMarketStatus());
    update();
    const interval = setInterval(update, 30000); // check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <MarketContext.Provider value={marketStatus}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
