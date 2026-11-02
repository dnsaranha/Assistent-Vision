import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdBannerProps {
  publisherId?: string;
  slotId?: string;
  onConfigure?: () => void;
}

export const AdBanner: React.FC<AdBannerProps> = ({ publisherId, slotId, onConfigure }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!publisherId || !slotId) {
      setAdLoaded(false);
      return;
    }

    let cancelled = false;
    const scriptId = 'google-adsense-script';
    const initializeAd = () => {
      if (cancelled || !adRef.current || adRef.current.dataset.initialized === 'true') return;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        adRef.current.dataset.initialized = 'true';
        setAdLoaded(true);
      } catch (error) {
        console.warn('Não foi possível inicializar o anúncio.', error);
      }
    };

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
      script.addEventListener('load', () => { script!.dataset.loaded = 'true'; initializeAd(); }, { once: true });
      script.addEventListener('error', () => setAdLoaded(false), { once: true });
      document.head.appendChild(script);
    } else if (script.dataset.loaded === 'true') {
      initializeAd();
    } else {
      script.addEventListener('load', initializeAd, { once: true });
    }

    return () => {
      cancelled = true;
      script?.removeEventListener('load', initializeAd);
    };
  }, [publisherId, slotId]);

  if (isDismissed) {
    return (
      <div className="w-full bg-gray-950/80 border-t border-gray-800 px-3 py-1 flex items-center justify-between text-[11px] text-gray-500">
        <span>Publicidade ocultada</span>
        <button onClick={() => setIsDismissed(false)} className="text-cyan-400 hover:text-cyan-300 underline">
          Reabrir
        </button>
      </div>
    );
  }

  const configured = Boolean(publisherId && slotId);

  return (
    <aside
      aria-label="Publicidade"
      className="w-full bg-gray-950/90 border-t border-gray-800 px-3 py-1.5 z-30"
    >
      <div className="max-w-7xl mx-auto min-h-10 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-center justify-center overflow-hidden">
          {configured ? (
            <div className="w-full max-w-[728px] text-center">
              <span className="block text-[9px] text-gray-500 uppercase tracking-wider">Publicidade</span>
              <ins
                ref={adRef}
                className="adsbygoogle"
                style={{ display: 'block', minHeight: '40px', width: '100%' }}
                data-ad-client={publisherId}
                data-ad-slot={slotId}
                data-ad-format="auto"
                data-full-width-responsive="true"
              />
              {!adLoaded && <span className="text-[10px] text-gray-600">Aguardando carregamento do anúncio</span>}
            </div>
          ) : (
            <div className="text-center">
              <span className="block text-[10px] font-semibold text-gray-400">Espaço publicitário</span>
              <span className="block text-[10px] text-gray-600">Configure um bloco aprovado para exibir anúncios</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!configured && onConfigure && (
            <button onClick={onConfigure} className="text-[10px] text-cyan-400 hover:text-cyan-300 underline">
              Configurar
            </button>
          )}
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Ocultar publicidade"
            title="Ocultar publicidade"
            className="text-gray-500 hover:text-gray-200 p-1 rounded"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
};
