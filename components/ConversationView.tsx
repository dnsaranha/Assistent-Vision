
import React, { useRef, useEffect } from 'react';
import { Message, Role } from '../types';

interface ConversationViewProps {
  messages: Message[];
  isLoading: boolean;
}

const LoadingIndicator: React.FC = () => (
    <div className="flex items-center space-x-2 animate-pulse">
        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animation-delay-200"></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animation-delay-400"></div>
    </div>
);

export const ConversationView: React.FC<ConversationViewProps> = ({ messages, isLoading }) => {
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-800/30">
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === Role.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-md p-3 rounded-lg text-sm ${
                message.role === Role.USER
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-md p-3 rounded-lg bg-gray-700 text-gray-200">
                <LoadingIndicator />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
};
