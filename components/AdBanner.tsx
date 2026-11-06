import React, { useEffect, useState, useRef } from 'react';

interface AdsConfig {
  enabled: boolean;
  clientId: string;
  slotId: string;
  format: string;
}

export const AdBanner: React.FC = () => {
  const [config, setConfig] = useState<AdsConfig | null>(null);
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return true;
    }
    return false;
  });
  const insRef = useRef<HTMLModElement | null>(null);
  const adPushedRef = useRef(false);

  useEffect(() => {
    fetch('/api/config/ads')
      .then(res => res.json())
      .then((data: AdsConfig) => {
        setConfig(data);
      })
      .catch(err => {
        console.debug('Failed to load ads config:', err);
      });
  }, []);

  // When config is enabled and the <ins> tag is mounted in the DOM, safely trigger adsbygoogle
  useEffect(() => {
    if (!config?.enabled || !config.clientId || !config.slotId || adPushedRef.current) {
      return;
    }

    const scriptId = 'google-ads-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const pushAd = () => {
      // Defer slightly to ensure the <ins> element is fully rendered in the DOM
      setTimeout(() => {
        try {
          if (!adPushedRef.current && insRef.current) {
            adPushedRef.current = true;
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          }
        } catch (e) {
          console.debug('AdSense push notice:', e);
        }
      }, 100);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.clientId)}`;
      script.onload = () => {
        pushAd();
      };
      document.head.appendChild(script);
    } else {
      pushAd();
    }
  }, [config]);

  if (isMinimized) {
    return (
      <aside aria-label="Espaço publicitário minimizado" className="w-full bg-gray-950/90 border-t border-gray-800 px-3 py-1.5 flex items-center justify-between text-xs text-gray-400 select-none">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-400 font-mono text-[10px] tracking-wide border border-cyan-800/40">
            ADS
          </span>
          <span className="text-gray-400 truncate">
            {config?.enabled ? `Google AdSense Conectado (${config.slotId})` : 'Espaço Comercial'}
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium transition-colors"
          title="Expandir banner de anúncios"
        >
          <span>Mostrar anúncio</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label="Espaço publicitário e comerciais" className="relative w-full bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-t border-cyan-900/30 shadow-2xl flex-shrink-0 z-20">
      {/* Top micro bar with tag and minimize control */}
      <div className="px-3 py-1 bg-black/40 border-b border-gray-800/40 flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/50 font-bold tracking-wider text-[9px] uppercase">
            {config?.enabled ? 'Google AdSense' : 'Comercial'}
          </span>
          <span className="text-gray-300 hidden sm:inline text-xs">
            {config?.enabled ? `Bloco de Anúncio ID: ${config.slotId}` : 'Espaço para Anúncios & Patrocinadores'}
          </span>
        </div>

        <button
          onClick={() => setIsMinimized(true)}
          className="hover:text-gray-200 transition-colors p-0.5 rounded hover:bg-gray-800/60"
          title="Minimizar anúncio"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Ad Content Container */}
      <div className="px-3 sm:px-4 py-2 flex flex-col items-center justify-center min-h-[64px]">
        {config?.enabled ? (
          <div className="w-full flex flex-col items-center justify-center">
            {/* Real Google AdSense Unit Tag */}
            <ins
              ref={insRef}
              className="adsbygoogle"
              style={{
                display: 'block',
                width: '100%',
                minHeight: '60px',
                textAlign: 'center',
              }}
              data-ad-client={config.clientId}
              data-ad-slot={config.slotId}
              data-ad-format={config.format || 'horizontal'}
              data-full-width-responsive="true"
            />

            {/* Informative helper while AdSense prepares to fill impressions */}
            <div className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5 text-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                AdSense ativo (ID: <code className="text-cyan-300 font-mono">{config.slotId}</code>). Para exibir campanhas reais, certifique-se de que a URL do seu app esteja cadastrada e aprovada na aba <strong>Sites</strong> do AdSense.
              </span>
            </div>
          </div>
        ) : (
          /* Elegant placeholder if no credentials are configured */
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-blue-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 shadow-inner">
                <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-gray-100 flex items-center gap-1.5">
                    <span>Espaço Comercial & Patrocínios</span>
                    <span className="text-[10px] font-normal text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/30">
                      Destaque
                    </span>
                  </h4>
                </div>
                <p className="text-[11px] text-gray-400 line-clamp-1">
                  Exiba sua marca para usuários que utilizam inteligência visual e assistência de voz em tempo real.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-3 py-1.5 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium text-xs shadow-md shadow-cyan-950/50 flex items-center gap-1.5">
                <span>Anuncie Conosco</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
