// Market hours utility: fixed IST trading window.
const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OPEN_MIN = 19 * 60; // 7:00 PM IST
const IST_CLOSE_MIN = 1 * 60 + 30; // 1:30 AM IST (next day)

function getTimeInZone(timeZone) {
  return new Date(new Date().toLocaleString('en-US', { timeZone }));
}

export function getIndianTime() {
  return getTimeInZone(IST_TIMEZONE);
}

function formatIstTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function isWithinIstTradingWindow(istNow) {
  const day = istNow.getDay(); // 0=Sun, 6=Sat
  const hour = istNow.getHours();
  const minute = istNow.getMinutes();
  const timeMin = hour * 60 + minute;

  const inLateSession = timeMin >= IST_OPEN_MIN;
  const inEarlySession = timeMin < IST_CLOSE_MIN;

  // Mon-Thu: same-day evening + next-day early-morning session
  if (day >= 1 && day <= 4) return inLateSession || inEarlySession;
  // Friday: evening session allowed
  if (day === 5) return inLateSession;
  // Saturday: only early-morning carryover from Friday session
  if (day === 6) return inEarlySession;
  // Sunday: fully closed
  return false;
}

export function isMarketOpen() {
  const istNow = getIndianTime();
  return isWithinIstTradingWindow(istNow);
}

export function getMarketStatus() {
  const istNow = getIndianTime();
  const day = istNow.getDay();
  const nextOpen = getNextMarketOpen();
  const nextOpenIst = formatIstTime(nextOpen);

  if (day === 0) {
    return {
      isOpen: false,
      message: `Market Closed — Weekend (Opens ${nextOpenIst} IST)`,
      nextOpen,
    };
  }

  const hour = istNow.getHours();
  const minute = istNow.getMinutes();
  const timeMin = hour * 60 + minute;

  if (!isWithinIstTradingWindow(istNow)) {
    return {
      isOpen: false,
      message: `Market Closed — Opens at ${nextOpenIst} IST`,
      nextOpen,
    };
  }

  return {
    isOpen: true,
    message: 'Market Open (7:00 PM - 1:30 AM IST)',
    nextOpen: null,
  };
}

function getNextMarketOpen() {
  const istNow = getIndianTime();

  for (let i = 0; i < 8; i += 1) {
    const candidate = new Date(istNow);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(19, 0, 0, 0);

    const day = candidate.getDay();
    if (day >= 1 && day <= 5 && candidate > istNow) {
      return candidate;
    }
  }

  const fallback = new Date(istNow);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(19, 0, 0, 0);
  return fallback;
}

export function formatCurrency(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
