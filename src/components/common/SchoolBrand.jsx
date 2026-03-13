import { useState } from 'react';

const LOGO_PATH = '/fslogonew.png';
const BRAND_NAME = 'Fountainhead School Trading Competition';

export default function SchoolBrand({ compact = false, className = '' }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      {!logoFailed ? (
        <img
          src={LOGO_PATH}
          alt="Fountainhead School logo"
          className={compact ? 'w-8 h-8 rounded-lg object-contain bg-white p-1' : 'w-12 h-12 rounded-xl object-contain bg-white p-1'}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className={compact ? 'w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center text-xs font-bold text-white' : 'w-12 h-12 rounded-xl bg-accent-blue flex items-center justify-center text-sm font-bold text-white'}>
          FS
        </div>
      )}

      <div>
        <div className={compact ? 'font-bold text-white text-sm leading-tight' : 'font-bold text-white text-lg leading-tight'}>
          Fountainhead School
        </div>
        <div className={compact ? 'text-xs text-gray-500' : 'text-sm text-gray-400'}>
          Trading Competition
        </div>
      </div>
    </div>
  );
}

export { BRAND_NAME, LOGO_PATH };
