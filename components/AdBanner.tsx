import React, { useState, useEffect } from 'react';

interface AdItem {
  id: string;
  advertiser: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  url: string;
  tag: string;
}

const AD_ROTATION: AdItem[] = [
  {
    id: 'ad-1',
    advertiser: 'Google Cloud Platform',
    badge: 'Anúncio Google',
    title: 'Acelere sua infraestrutura de IA com Google Cloud',
    description: 'Comece hoje com US$ 300 em créditos gratuitos e escale seus modelos com GPUs de ponta.',
    cta: 'Começar Grátis',
    url: 'https://cloud.google.com',
    tag: 'Cloud & AI',
  },
  {
    id: 'ad-2',
    advertiser: 'Google Workspace',
    badge: 'Anúncio Google',
    title: 'Gmail, Drive, Meet e Gemini integrados para sua equipe',
    description: 'Aumente a produtividade da sua empresa com inteligência artificial integrada.',
    cta: 'Experimentar',
    url: 'https://workspace.google.com',
    tag: 'Produtividade',
  },
  {
    id: 'ad-3',
    advertiser: 'Firebase App Development',
    badge: 'Anúncio AdMob',
    title: 'Crie apps modernos e escaláveis com Firebase & Firestore',
    description: 'Banco NoSQL em tempo real, autenticação e hospedagem global em minutos.',
    cta: 'Saiba Mais',
    url: 'https://firebase.google.com',
    tag: 'Desenvolvedor',
  },
];

interface AdBannerProps {
  publisherId?: string;
  slotId?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  publisherId: propPublisherId,
  slotId: propSlotId,
}) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [serverPublisherId, setServerPublisherId] = useState<string>('');
  const [serverSlotId, setServerSlotId] = useState<string>('');

  // Fetch project-level ad configuration from backend
  useEffect(() => {
    fetch('/api/ad-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.publisherId) setServerPublisherId(data.publisherId);
        if (data?.slotId) setServerSlotId(data.slotId);
      })
      .catch((err) => {
        console.debug('Ad config fetch:', err);
      });
  }, []);

  const activePublisherId = propPublisherId || serverPublisherId;
  const activeSlotId = propSlotId || serverSlotId;

  // Load real AdSense script if publisherId is provided
  useEffect(() => {
    if (!activePublisherId) return;

    const scriptId = 'google-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${activePublisherId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          setAdLoaded(true);
        } catch (e) {
          console.debug('AdSense init error:', e);
        }
      };
      document.head.appendChild(script);
    }
  }, [activePublisherId]);

  // Rotate demo ads every 20 seconds
  useEffect(() => {
    if (isDismissed || isHovered || (activePublisherId && activeSlotId)) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % AD_ROTATION.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [isDismissed, isHovered, activePublisherId, activeSlotId]);

  if (isDismissed) {
    return (
      <div className="w-full bg-gray-950/80 border-t border-gray-800 px-3 py-1 flex items-center justify-between text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Espaço publicitário AdMob ativo
        </span>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-cyan-400 hover:text-cyan-300 underline"
        >
          Reabrir banner
        </button>
      </div>
    );
  }

  const currentAd = AD_ROTATION[currentAdIndex];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 border-t border-gray-800 shadow-xl transition-all duration-300 select-none z-30"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-2">
        {activePublisherId && activeSlotId ? (
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Google AdSense Ativo
              </span>
              <span className="text-[10px] text-gray-400 font-mono hidden md:inline">
                {activePublisherId}
              </span>
            </div>

            <div className="flex-1 min-w-0 flex justify-center overflow-hidden">
              <ins
                className="adsbygoogle"
                style={{ display: 'inline-block', width: '100%', maxWidth: '728px', height: '50px' }}
                data-ad-client={activePublisherId}
                data-ad-slot={activeSlotId}
                data-ad-format="horizontal"
                data-full-width-responsive="true"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsDismissed(true)}
                title="Minimizar publicidade"
                className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Left: Ad Label & AdMob badge */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {currentAd.badge}
              </span>
              <span className="text-[10px] text-gray-400 hidden md:inline">
                Espaço Monetizado
              </span>
            </div>

            {/* Center: Ad Copy / Sponsored Message */}
            <div className="flex-1 min-w-0 text-left sm:px-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-100 truncate">
                  {currentAd.title}
                </span>
                <span className="hidden lg:inline text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700">
                  {currentAd.tag}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate hidden sm:block">
                {currentAd.description}
              </p>
            </div>

            {/* Right: CTA & Controls */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <a
                href={currentAd.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-colors"
              >
                <span>{currentAd.cta}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {/* AdChoices Info Icon */}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                title="AdChoices - Controle de publicidade do Google"
                className="text-gray-500 hover:text-gray-300 p-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
              </a>

              {/* Minimize button */}
              <button
                onClick={() => setIsDismissed(true)}
                title="Minimizar publicidade"
                className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
