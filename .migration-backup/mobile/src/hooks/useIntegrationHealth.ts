import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { API_URL } from '../lib/api';

export interface IntegrationHealth {
  allReady: boolean;
  servicesReady: boolean;
  services: {
    payments?: { verified: boolean; status: string };
    email?: { verified: boolean; status: string };
    sendgrid?: { verified: boolean; status: string };
    twilio?: { verified: boolean; status: string };
  };
}

export function useIntegrationHealth() {
  const { token } = useAuthStore();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/integrations/health`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      } else {
        setError('Failed to check integration status');
      }
    } catch (err) {
      setError('Network error checking integrations');
      if (__DEV__) console.error('Failed to fetch integration health:', err);
    }
    
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    fetchHealth();
    
    const interval = setInterval(fetchHealth, 300000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return {
    health,
    isLoading,
    error,
    refetch: fetchHealth,
    isEmailReady: health?.services?.sendgrid?.verified ?? health?.services?.email?.verified ?? false,
    isSmsReady: health?.services?.twilio?.verified ?? false,
    isPaymentReady: health?.services?.payments?.verified ?? false,
  };
}
