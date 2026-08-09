import { useEffect } from 'react';
import { router } from 'expo-router';

export default function PaymentsScreen() {
  useEffect(() => {
    router.replace('/more/payment-hub');
  }, []);
  
  return null;
}
