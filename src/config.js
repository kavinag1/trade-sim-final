// Finnhub API configuration
export const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Admin emails - users with these emails get admin access
export const ADMIN_EMAILS = [
  'kavinagrawal20@gmail.com',
  's.manit.bhasin@fountainheadschools.org',
  's.vardhan.bothra@fountainheadschools.org',
];

// Competition settings
export const STARTING_BALANCE = 100000;

// Market hours (Eastern Time)
export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MINUTE = 30;
export const MARKET_CLOSE_HOUR = 16;
export const MARKET_CLOSE_MINUTE = 0;
