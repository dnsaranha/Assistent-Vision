import React, { useState, useEffect } from 'react';

interface MicPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryStart: () => void;
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({
  isOpen,
  onClose,
  onRetryStart,
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'denied'>('idle');
  const [testVolume, setTestVolume] = useState<number>(0);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    if (!isOpen) {
      setTestStatus('idle');
      setTestVolume(0);
    }
  }, [isOpen]);

  const handleTestMic = async () => {
    setTestStatus('testing');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setTestStatus('success');

      // Setup quick VU meter test
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;
      const measure = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = sum / data.length;
        setTestVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animId = requestAnimationFrame(measure);
      };
      measure();

      setTimeout(() => {
        cancelAnimationFrame(animId);
        stream.getTracks().forEach((t) => t.stop());
        if (audioCtx.state !== 'closed') audioCtx.close();
      }, 4000);
    } catch (err: any) {
      console.warn('Microphone permission test error:', err);
      setTestStatus('denied');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Permissão do Microfone</h3>
              <p className="text-xs text-gray-400">Por que o erro acontece e como liberar em 1 minuto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Por que o erro acontece?</span>
            </div>
            <p className="text-cyan-200/90 text-[11px] leading-relaxed">
              Os navegadores modernos (Google Chrome, Edge, Safari) bloqueiam o microfone por segurança caso você tenha clicado em "Bloquear", se a janela estiver sem permissão ou se o aplicativo estiver dentro da moldura/iframe do AI Studio.
            </p>
          </div>

          {/* Iframe Notice & New Tab Button */}
          {isInIframe && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-300 text-xs">Acessando pela visualização do AI Studio</p>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  Navegadores restringem microfone em telas embutidas (iframes). Abrir em aba cheia resolve de imediato.
                </p>
              </div>
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition shrink-0 flex items-center gap-1.5"
              >
                <span>Abrir em Nova Aba</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Step by Step Instructions */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-200 text-xs uppercase tracking-wider">Como desbloquear no navegador:</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700/70 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">📱 No Celular (Android / Chrome)</span>
                <ol className="list-decimal pl-4 space-y-1 text-gray-300 text-[11px]">
                  <li>Toque no ícone de <strong>configurações / cadeado</strong> na barra de endereços (onde fica o link).</li>
                  <li>Acesse <strong>Permissões</strong>.</li>
                  <li>Ative a opção <strong>Microfone</strong> para "Permitido".</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700/70 space-y-1">
                <span className="font-bold text-cyan-400 text-[11px]">💻 No Computador (Chrome / Edge)</span>
                <ol className="list-decimal pl-4 space-y-1 text-gray-300 text-[11px]">
                  <li>Clique no ícone de <strong>cadeado ou ajustes</strong> à esquerda do link (URL).</li>
                  <li>Localize a linha <strong>Microfone</strong>.</li>
                  <li>Mude de "Bloquear" para <strong>Permitir</strong>.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Real-time Mic Test Section */}
          <div className="p-4 rounded-xl bg-gray-800/80 border border-gray-700 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-200 text-xs">Teste de Microfone em Tempo Real</span>
                <p className="text-[11px] text-gray-400">Verifique se o seu navegador já autorizou o microfone.</p>
              </div>
              <button
                onClick={handleTestMic}
                disabled={testStatus === 'testing'}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition cursor-pointer"
              >
                {testStatus === 'testing' ? 'Testando...' : 'Testar Agora'}
              </button>
            </div>

            {testStatus === 'success' && (
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span>✓ Microfone funcionando com sucesso!</span>
                </div>
                <div className="w-full bg-gray-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-75"
                    style={{ width: `${testVolume}%` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-300">Fale algo para ver o medidor de volume reagir.</p>
              </div>
            )}

            {testStatus === 'denied' && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs animate-fade-in">
                ✕ O navegador ainda recusou o acesso. Siga os passos acima na barra de endereços para permitir.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-xs transition cursor-pointer"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              onClose();
              onRetryStart();
            }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Ligar Microfone Novamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
