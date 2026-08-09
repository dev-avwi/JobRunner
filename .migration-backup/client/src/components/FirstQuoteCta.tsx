import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";

interface FirstQuoteCtaProps {
  onCreateQuote?: () => void;
}

export function useIsBrandNewOwner() {
  const { data: jobs } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    staleTime: 60 * 1000,
  });
  const { data: quotes } = useQuery<any[]>({
    queryKey: ["/api/quotes"],
    staleTime: 60 * 1000,
  });
  const { data: invoices } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    staleTime: 60 * 1000,
  });
  const { data: activities } = useQuery<any[]>({
    queryKey: ["/api/activity-feed", { limit: 1 }],
    queryFn: async () => {
      const res = await fetch("/api/activity-feed?limit=1", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const ready =
    jobs !== undefined &&
    quotes !== undefined &&
    invoices !== undefined &&
    activities !== undefined;

  const isBrandNew =
    ready &&
    (jobs?.length ?? 0) === 0 &&
    (quotes?.length ?? 0) === 0 &&
    (invoices?.length ?? 0) === 0 &&
    (activities?.length ?? 0) === 0;

  return { isBrandNew, ready };
}

export default function FirstQuoteCta({ onCreateQuote }: FirstQuoteCtaProps) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (onCreateQuote) {
      onCreateQuote();
    } else {
      navigate("/quotes/new");
    }
  };

  return (
    <Card data-testid="first-quote-cta" className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold mb-1">Create your first quote</h3>
          <p className="text-sm text-muted-foreground">
            Send a professional quote in minutes. Your dashboard fills up from here.
          </p>
        </div>
        <Button
          onClick={handleClick}
          data-testid="button-first-quote-cta"
          className="shrink-0"
        >
          Create your first quote
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
