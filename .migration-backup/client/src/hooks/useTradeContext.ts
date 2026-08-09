import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  tradeCatalog,
  getTradeDefinition,
  getTradeTerminology,
  getTradeJobStages,
  getTradeCustomFields,
  getTradeDefaultMaterials,
  getTradeDefaultRateCard,
  getTradeSafetyChecklists,
  TradeDefinition,
  TradeTerminology,
  TradeJobStage,
  TradeCustomField,
  TradeMaterial,
  TradeRateCard,
  TradeSafetyChecklist,
} from "@shared/tradeCatalog";

interface TradeContext {
  tradeId: string | null;
  trade: TradeDefinition | null;
  terminology: TradeTerminology;
  jobStages: TradeJobStage[];
  customFields: TradeCustomField[];
  defaultMaterials: TradeMaterial[];
  defaultRateCard: TradeRateCard;
  safetyChecklists: TradeSafetyChecklist[];
  isLoading: boolean;
  t: (key: keyof TradeTerminology) => string;
}

const defaultTerminology: TradeTerminology = {
  job: "Job",
  jobs: "Jobs",
  client: "Client",
  clients: "Clients",
  quote: "Quote",
  quotes: "Quotes",
  worksite: "Site",
  worksites: "Sites",
};

const defaultRateCard: TradeRateCard = {
  hourlyRate: 75,
  calloutFee: 50,
  afterHoursMultiplier: 1.5,
  weekendMultiplier: 1.5,
  materialMarkupPct: 15,
};

export function useTradeContext(): TradeContext {
  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const tradeId = user?.tradeType || null;

  const trade = useMemo(() => {
    if (!tradeId) return null;
    return getTradeDefinition(tradeId) || null;
  }, [tradeId]);

  const terminology = useMemo(() => {
    if (!tradeId) return defaultTerminology;
    return getTradeTerminology(tradeId);
  }, [tradeId]);

  const jobStages = useMemo(() => {
    if (!tradeId) return [];
    return getTradeJobStages(tradeId);
  }, [tradeId]);

  const customFields = useMemo(() => {
    if (!tradeId) return [];
    return getTradeCustomFields(tradeId);
  }, [tradeId]);

  const defaultMaterials = useMemo(() => {
    if (!tradeId) return [];
    return getTradeDefaultMaterials(tradeId);
  }, [tradeId]);

  const rateCard = useMemo(() => {
    if (!tradeId) return defaultRateCard;
    return getTradeDefaultRateCard(tradeId);
  }, [tradeId]);

  const safetyChecklists = useMemo(() => {
    if (!tradeId) return [];
    return getTradeSafetyChecklists(tradeId);
  }, [tradeId]);

  const t = useMemo(() => {
    return (key: keyof TradeTerminology) => terminology[key];
  }, [terminology]);

  return {
    tradeId,
    trade,
    terminology,
    jobStages,
    customFields,
    defaultMaterials,
    defaultRateCard: rateCard,
    safetyChecklists,
    isLoading,
    t,
  };
}

export { tradeCatalog, getTradeDefinition };
export type { TradeDefinition, TradeTerminology, TradeJobStage, TradeCustomField, TradeMaterial, TradeRateCard, TradeSafetyChecklist };
