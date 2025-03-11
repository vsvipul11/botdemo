// components/ScriptLoader.tsx
'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export function ScriptLoader() {
  useEffect(() => {
    if (window.gapi && window.google) {
      window.dispatchEvent(new Event('googleAPIsLoaded'));
    }
  }, []);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="beforeInteractive"
        onError={(e) => {
          console.error('Error loading Google Identity Services:', e);
        }}
        onLoad={() => {
          console.log('Google Identity Services loaded');
        }}
      />
      
      <Script
        src="https://apis.google.com/js/api.js"
        strategy="beforeInteractive"
        onError={(e) => {
          console.error('Error loading Google API Client:', e);
        }}
        onLoad={() => {
          console.log('Google API Client loaded');
          window.dispatchEvent(new Event('googleAPIsLoaded'));
        }}
      />

      <Script
        src="https://cdn.usefathom.com/script.js"
        data-site="ONYOCTXK"
        strategy="afterInteractive"
        defer
      />
    </>
  );
}
