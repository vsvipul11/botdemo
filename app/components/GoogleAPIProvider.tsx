// components/GoogleAPIProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface GoogleAPIContextType {
  isLoaded: boolean;
  error: string | null;
}

const GoogleAPIContext = createContext<GoogleAPIContextType>({
  isLoaded: false,
  error: null
});

export function GoogleAPIProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    function checkAPIs() {
      if ((window as any).gapi && (window as any).google) {
        setIsLoaded(true);
      } else {
        timeoutId = setTimeout(checkAPIs, 100);
      }
    }

    function handleLoad() {
      checkAPIs();
    }

    function handleError() {
      setError('Failed to load Google APIs');
    }

    window.addEventListener('googleAPIsLoaded', handleLoad);
    window.addEventListener('error', handleError);

    // Start checking
    checkAPIs();

    // Set a timeout for loading
    const loadTimeout = setTimeout(() => {
      if (!isLoaded) {
        setError('Google APIs failed to load in time');
      }
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(loadTimeout);
      window.removeEventListener('googleAPIsLoaded', handleLoad);
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded">
        <p>Error loading Google APIs: {error}</p>
      </div>
    );
  }

  return (
    <GoogleAPIContext.Provider value={{ isLoaded, error }}>
      {children}
    </GoogleAPIContext.Provider>
  );
}

export const useGoogleAPI = () => useContext(GoogleAPIContext);
