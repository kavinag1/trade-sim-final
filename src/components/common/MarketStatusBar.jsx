import { useMarket } from '../../contexts/MarketContext';

export default function MarketStatusBar() {
  const { isOpen, message } = useMarket();

  return (
    <div className={`px-6 py-2 flex items-center gap-2 text-xs font-medium border-b ${
      isOpen
        ? 'bg-emerald-900/20 border-accent-green/20 text-accent-green'
        : 'bg-red-900/20 border-accent-red/20 text-accent-red'
    }`}>
      <span className={`inline-block w-2 h-2 rounded-full ${
        isOpen ? 'bg-accent-green animate-pulse' : 'bg-accent-red'
      }`} />
      {message}
      {!isOpen && (
        <span className="ml-2 text-gray-500">— Trading is disabled</span>
      )}
    </div>
  );
}
