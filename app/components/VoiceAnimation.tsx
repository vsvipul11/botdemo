'use client';

import React from 'react';

interface VoiceAnimationProps {
  isActive?: boolean;
}

const VoiceAnimation: React.FC<VoiceAnimationProps> = ({ isActive = false }) => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative flex items-center justify-center">
        {/* Base circle */}
        <div 
          className={`w-24 h-24 bg-red-500 rounded-full flex items-center justify-center transform transition-transform duration-300
            ${isActive ? 'scale-110' : 'scale-100'}`}
        >
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-red-700 rounded-full" />
          </div>
        </div>

        {/* Ripple effects */}
        {isActive && (
          <>
            {/* First ripple */}
            <div className="absolute inset-0 w-32 h-32">
              <div className="absolute inset-0 bg-red-500 rounded-full opacity-75 animate-ripple" />
            </div>
            {/* Second ripple */}
            <div className="absolute inset-0 w-40 h-40">
              <div className="absolute inset-0 bg-red-500 rounded-full opacity-50 animate-ripple-delayed" />
            </div>
            {/* Third ripple */}
            <div className="absolute inset-0 w-48 h-48">
              <div className="absolute inset-0 bg-red-500 rounded-full opacity-25 animate-ripple-slow" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceAnimation;