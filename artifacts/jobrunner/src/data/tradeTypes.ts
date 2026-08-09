/**
 * Trade types - now powered by the centralized trade catalog
 * This file provides backward compatibility with the old API
 */
import { tradeCatalog, getTradeDefinition, getTradeOptions as getCatalogTradeOptions, TradeDefinition } from "@shared/tradeCatalog";

export const tradeTypes = Object.fromEntries(
  Object.entries(tradeCatalog).map(([key, trade]) => [
    key,
    {
      name: trade.name,
      color: trade.color,
      description: trade.description,
      typicalJobs: trade.typicalJobs,
    },
  ])
);

export type TradeType = keyof typeof tradeCatalog;

export const getTradeInfo = (tradeType: string): TradeDefinition | { name: string; color: string; description: string; typicalJobs: string[] } => {
  const trade = getTradeDefinition(tradeType);
  if (trade) return trade;
  
  return {
    name: "Other Trade Services",
    color: "#6b7280",
    description: "General contracting and trade services",
    typicalJobs: ["Custom services", "Maintenance", "Repairs", "Consultation"],
  };
};

export const getTradeOptions = getCatalogTradeOptions;

export { tradeCatalog, getTradeDefinition };
