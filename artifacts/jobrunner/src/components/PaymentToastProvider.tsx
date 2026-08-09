import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, PartyPopper } from 'lucide-react';

interface PaymentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  relatedId?: string;
}

export function PaymentToastProvider() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastSeenTimestampRef = useRef<string | null>(null);
  const hasShownInitialRef = useRef(false);

  const { data: notifications } = useQuery<PaymentNotification[]>({
    queryKey: ['/api/notifications'],
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const paymentNotifications = notifications.filter(n => n.type === 'invoice_paid');
    
    if (paymentNotifications.length === 0) return;

    const latestPayment = paymentNotifications[0];
    
    if (!hasShownInitialRef.current) {
      lastSeenTimestampRef.current = latestPayment.createdAt;
      hasShownInitialRef.current = true;
      return;
    }

    if (lastSeenTimestampRef.current && latestPayment.createdAt > lastSeenTimestampRef.current) {
      const invoiceMatch = latestPayment.message.match(/Invoice #([^\s]+)/);
      const invoiceNumber = invoiceMatch ? invoiceMatch[1] : '';
      
      toast({
        title: "Cha-ching! Payment received",
        description: invoiceNumber 
          ? `Invoice #${invoiceNumber} has been paid!` 
          : latestPayment.message,
        duration: 8000,
      });

      lastSeenTimestampRef.current = latestPayment.createdAt;
      
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    }
  }, [notifications, toast, queryClient]);

  return null;
}

export default PaymentToastProvider;
