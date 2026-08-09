import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function CreateQuoteRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  useEffect(() => {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const targetRoute = queryString 
      ? `/more/quote/new?${queryString}` 
      : '/more/quote/new';
    
    router.replace(targetRoute as any);
  }, []);

  return null;
}
