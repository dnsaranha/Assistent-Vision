
import React, { useState, useEffect, useCallback } from 'react';

export interface Settings {
    micSensitivity: number;
    audioOutputDeviceId: string;
    voiceModel: string;
    shareSystemAudio: boolean;
    systemInstruction: string;
    liveSystemInstruction: string;
    adMobPublisherId?: string;
    adMobSlotId?: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
}

const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        if (isOpen) {
            const getDevices = async () => {
                try {
                    // We need to request mic permission to get the full list of device labels
                    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
                        setAudioDevices(audioOutputDevices);
                    } finally {
                        // The temporary stream is only used to reveal device labels.
                        // Always release the microphone immediately after enumeration.
                        permissionStream.getTracks().forEach(track => track.stop());
                    }
                } catch (err) {
                    console.error("Could not enumerate audio devices:", err);
                    // Add the default device as a fallback
                    setAudioDevices([{
                        deviceId: 'default',
                        kind: 'audiooutput',
                        label: 'Default',
                        groupId: '',
                        toJSON: () => {}
                    }]);
                }
            };
            getDevices();
        }
    }, [isOpen]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4 text-gray-200 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <header className="px-6 pt-6 pb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-cyan-400">Configurações</h2>
                </header>
                
                <main className="overflow-y-auto px-6">
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="mic-sensitivity" className="block text-sm font-medium mb-2">
                                Sensibilidade do Microfone (Visual)
                            </label>
                            <div className="flex items-center space-x-3">
                                <input
                                    id="mic-sensitivity"
                                    type="range"
                                    min="0.1"
                                    max="3.0"
                                    step="0.1"
                                    value={settings.micSensitivity}
                                    onChange={e => onSettingsChange({ ...settings, micSensitivity: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-sm text-gray-400 w-10 text-center">{settings.micSensitivity.toFixed(1)}</span>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="audio-output" className="block text-sm font-medium mb-2">
                                Saída de Áudio
                            </label>
                            <select
                                id="audio-output"
                                value={settings.audioOutputDeviceId}
                                onChange={e => onSettingsChange({ ...settings, audioOutputDeviceId: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                {audioDevices.length > 0 ? (
                                    audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Dispositivo ${audioDevices.indexOf(device) + 1}`}
                                        </option>
                                    ))
                                ) : (
                                    <option value="default">Padrão</option>
                                )}
                            </select>
                        </div>

                         <div>
                            <label htmlFor="voice-model" className="block text-sm font-medium mb-2">
                                Voz do Assistente
                            </label>
                            <select
                                id="voice-model"
                                value={settings.voiceModel}
                                onChange={e => onSettingsChange({ ...settings, voiceModel: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                {VOICES.map(voice => (
                                    <option key={voice} value={voice}>
                                        {voice}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="share-audio" className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium">Compartilhar Áudio do Sistema</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        id="share-audio"
                                        className="sr-only"
                                        checked={settings.shareSystemAudio}
                                        onChange={e => onSettingsChange({ ...settings, shareSystemAudio: e.target.checked })}
                                    />
                                    <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.shareSystemAudio ? 'transform translate-x-6 bg-cyan-400' : ''}`}></div>
                                </div>
                            </label>
                             <p className="text-xs text-gray-400 mt-1">
                                Permite que o assistente ouça o áudio da aba ou aplicativo que você está compartilhando.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="system-instruction" className="block text-sm font-medium mb-2">
                               Instruções de Sistema (Texto)
                            </label>
                            <textarea
                                id="system-instruction"
                                rows={5}
                                value={settings.systemInstruction}
                                onChange={e => onSettingsChange({ ...settings, systemInstruction: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Defina o comportamento do assistente..."
                            />
                        </div>
                         <div>
                            <label htmlFor="live-system-instruction" className="block text-sm font-medium mb-2">
                               Instruções de Sistema (Voz)
                            </label>
                            <textarea
                                id="live-system-instruction"
                                rows={4}
                                value={settings.liveSystemInstruction}
                                onChange={e => onSettingsChange({ ...settings, liveSystemInstruction: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Defina o comportamento do assistente de voz..."
                            />
                        </div>

                        {/* Monetization & Publicidade (AdSense / AdMob) */}
                        <div className="pt-4 border-t border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 uppercase">
                                    Monetização
                                </span>
                                <h3 className="text-sm font-semibold text-gray-200">Publicidade Google AdSense / AdMob</h3>
                            </div>

                            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                Em aplicações Web e PWAs (celular ou PC), a rede de publicidade do Google opera via <strong className="text-gray-200">Google AdSense</strong>. O AdMob é utilizado quando o aplicativo é empacotado nativamente (.apk).
                            </p>

                            <div className="space-y-3 bg-gray-900/60 p-3 rounded-lg border border-gray-700/80">
                                <div>
                                    <label htmlFor="ad-pub-id" className="block text-xs font-medium text-gray-300 mb-1">
                                        ID de Editor (Publisher ID)
                                    </label>
                                    <input
                                        id="ad-pub-id"
                                        type="text"
                                        placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                                        value={settings.adMobPublisherId || ''}
                                        onChange={e => onSettingsChange({ ...settings, adMobPublisherId: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="ad-slot-id" className="block text-xs font-medium text-gray-300 mb-1">
                                        ID do Bloco de Anúncios (Ad Slot ID)
                                    </label>
                                    <input
                                        id="ad-slot-id"
                                        type="text"
                                        placeholder="Ex: 1234567890"
                                        value={settings.adMobSlotId || ''}
                                        onChange={e => onSettingsChange({ ...settings, adMobSlotId: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                                    />
                                </div>

                                <div className="p-2.5 rounded bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-300 space-y-1">
                                    <p className="font-semibold text-blue-200">Requisitos para veicular anúncios reais:</p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-blue-300/90">
                                        <li>Conta ativa e aprovada no Google AdSense.</li>
                                        <li>Domínio público adicionado e verificado no painel do AdSense.</li>
                                        <li>Enquanto em ambiente de teste ou sem IDs, exibimos banners demonstrativos.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="px-6 pt-4 pb-6 text-right flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                    >
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};
