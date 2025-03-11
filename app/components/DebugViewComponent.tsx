import React, { useState, useCallback, useEffect, useRef } from 'react';
import { UltravoxExperimentalMessageEvent } from 'ultravox-client';
import { Switch } from '@/components/ui/switch';

interface DebugViewComponentProps {
  debugMessages: UltravoxExperimentalMessageEvent[];
  isCallActive: boolean;
  onStartCall: (modelOverride?: string, showDebugMessages?: boolean) => void;
  modelOverride?: string;
  showDebugMessages?: boolean;
}

const DebugViewComponent = ({
  debugMessages,
  isCallActive,
  onStartCall,
  modelOverride,
  showDebugMessages: initialShowDebugMessages = false
}: DebugViewComponentProps) => {
  const [messages, setMessages] = useState<UltravoxExperimentalMessageEvent[]>([]);
  const [showDebugMessages, setShowDebugMessages] = useState(initialShowDebugMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(debugMessages);
  }, [debugMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggle = useCallback(() => {
    setShowDebugMessages(prev => !prev);
  }, []);

  if (!isCallActive) {
    return (
      <div className="h-[300px] text-gray-400 mb-6 mt-32 lg:mt-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-mono mr-4">Debug View</h2>
            <Switch
              checked={showDebugMessages}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          
          {showDebugMessages && (
            <div className="flex-1 border border-[#3A3B3F] rounded p-4 overflow-hidden">
              <div ref={scrollRef} className="h-full overflow-y-auto">
                {messages.map((msg, index) => (
                  <p
                    key={index}
                    className="text-sm font-mono text-gray-200 py-2 border-dotted border-b border-[#3A3B3F] break-words"
                  >
                    {msg.message.message}
                  </p>
                ))}
              </div>
            </div>
          )}
          
          <button
            type="button"
            className="hover:bg-gray-700 px-6 py-2 border-2 w-full mt-4"
            onClick={() => onStartCall(modelOverride, showDebugMessages)}
          >
            Start Call
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default DebugViewComponent;