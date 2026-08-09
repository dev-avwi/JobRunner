import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function CreateInvoiceRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  useEffect(() => {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const targetRoute = queryString 
      ? `/more/invoice/new?${queryString}` 
      : '/more/invoice/new';
    
    router.replace(targetRoute as any);
  }, []);

  return null;
}
