import React from 'react';

interface LoginGateProps {
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
  onClearError?: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onSignIn,
  isLoading,
  error,
  onClearError,
}) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-gray-900/90 border border-gray-800 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col items-center text-center">
        
        {/* App Logo & Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-5">
          <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium mb-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Concessão de Acesso Exclusiva
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          Vision Assist
        </h1>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          Assistente inteligente com visão de tela, roteiros passo a passo e voz em tempo real.
        </p>

        {/* Feature summary cards */}
        <div className="w-full space-y-2.5 mb-6 text-left">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-800/40 border border-gray-800">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-200">Guia Visual pelo Assistente</p>
              <p className="text-[11px] text-gray-400">Setas dinâmicas, círculos de foco e etapas numeradas desenhadas pela IA na sua tela.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-800/40 border border-gray-800">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-200">Voz e Visão em Tempo Real</p>
              <p className="text-[11px] text-gray-400">Conversas fluidas e bidirecionais com visão contínua no celular ou computador.</p>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-left flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <span>{error}</span>
            </div>
            {onClearError && (
              <button onClick={onClearError} className="text-red-400 hover:text-red-200">✕</button>
            )}
          </div>
        )}

        {/* Google / Gmail Access Grant Button */}
        <button
          onClick={onSignIn}
          disabled={isLoading}
          className="w-full group relative flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-gray-800 hover:bg-gray-100 font-semibold text-sm shadow-xl shadow-black/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin" />
              <span>Conectando com o Google...</span>
            </div>
          ) : (
            <>
              {/* Official Google G Logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com conta Gmail (Google)</span>
            </>
          )}
        </button>

        <p className="mt-4 text-[11px] text-gray-500 leading-normal">
          Acesso seguro autenticado via Firebase Auth. Somente contas Google são aceitas para concessão de acesso.
        </p>

        {/* Security / Privacy Trust Footer */}
        <div className="mt-6 pt-5 border-t border-gray-800/80 w-full flex items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Google Identity
          </span>
          <span className="text-gray-700">•</span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            SSL / HTTPS
          </span>
          <span className="text-gray-700">•</span>
          <span>Sem senhas locais</span>
        </div>

      </div>
    </div>
  );
};
