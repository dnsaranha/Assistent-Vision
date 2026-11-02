
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Message, Role } from '../types';
import { ChevronDownIcon } from './Icons';

interface ConversationViewProps {
  messages: Message[];
  isLoading: boolean;
}

const LoadingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2 animate-pulse py-1">
    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
);

export const ConversationView: React.FC<ConversationViewProps> = ({ messages, isLoading }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior, block: 'end' });
    }
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Automatically scroll to bottom whenever a new message is added or loading status updates
  useEffect(() => {
    prevMessagesLengthRef.current = messages.length;

    // Use requestAnimationFrame and a fallback timeout to ensure layout calculations are complete
    const rafId = requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });

    const timeoutId = setTimeout(() => {
      scrollToBottom('smooth');
    }, 60);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [messages, isLoading, scrollToBottom]);

  // Monitor scroll position to show a quick "Scroll to bottom" helper button if user scrolls up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottomBtn(distanceToBottom > 100);
  }, []);

  return (
    <div 
      ref={containerRef} 
      onScroll={handleScroll}
      className="flex-1 min-h-0 p-4 overflow-y-auto scroll-smooth bg-gray-800/30 relative"
    >
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex animate-fade-in ${message.role === Role.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-xl md:max-w-2xl p-3 rounded-lg text-sm transition-all duration-200 shadow-sm break-words leading-relaxed ${
                message.role === Role.USER
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700/90 text-gray-200 rounded-bl-none border border-gray-600/30'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[92%] sm:max-w-md p-3 rounded-lg bg-gray-700/90 text-gray-200 border border-gray-600/30 rounded-bl-none">
              <LoadingIndicator />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-0 w-0" />
      </div>

      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="sticky bottom-2 float-right flex items-center gap-1 px-3 py-1.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-medium shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 animate-fade-in border border-cyan-400/40 z-20"
          aria-label="Rolar para o final"
        >
          <span>Ir para o final</span>
          <ChevronDownIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
