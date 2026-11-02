import React from 'react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';
import { SettingsIcon } from './Icons';

interface HeaderProps {
  user: User | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
  isSharing: boolean;
  isLive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onSignOut,
  onOpenSettings,
  isSharing,
  isLive,
}) => {
  return (
    <header className="bg-gray-950/80 backdrop-blur-md border-b border-gray-800 px-3 sm:px-5 py-2.5 flex items-center justify-between z-30 select-none">
      {/* Left: App Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <img
            src="/logo.png"
            alt="Vision Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-lg shadow-cyan-500/20 border border-cyan-500/30 transition-transform group-hover:scale-105"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-gray-950" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
              Vision
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Assistente Visual IA
            </span>
          </div>
          <span className="text-[10px] text-gray-400 hidden xs:inline">
            Orientação e Roteiros Passo a Passo
          </span>
        </div>
      </div>

      {/* Center: Live / Sharing Activity Badges */}
      <div className="hidden md:flex items-center gap-2">
        {isSharing && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Tela Ativa
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Voz ao Vivo
          </span>
        )}
      </div>

      {/* Right: PWA Install + User Profile + Settings */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* User Profile Avatar & Sign Out */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-700 object-cover"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow">
                  {(user.displayName || user.email || 'G').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-gray-200 leading-tight truncate max-w-[120px]">
                  {user.displayName || 'Google'}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight truncate max-w-[120px]">
                  {user.email}
                </span>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800/80 transition cursor-pointer"
              title="Encerrar sessão"
            >
              Sair
            </button>
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition cursor-pointer"
          title="Configurações do Vision"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
};
