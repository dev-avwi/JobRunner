import type { Request, Response, NextFunction } from "express";

interface RouteStat {
  count: number;
  errors: number;
  samples: number[];
}

const MAX_SAMPLES = 500;
const stats = new Map<string, RouteStat>();
let totalRequests = 0;
let totalErrors = 0;
let total429 = 0;
let total504 = 0;

function routeKey(method: string, path: string): string {
  let normalized = path
    .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "/:id")
    .replace(/\/\d+/g, "/:id");
  if (normalized.length > 80) normalized = normalized.slice(0, 80);
  return `${method} ${normalized}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) return next();
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    totalRequests++;
    if (res.statusCode >= 500) totalErrors++;
    if (res.statusCode === 429) total429++;
    if (res.statusCode === 504) total504++;

    const key = routeKey(req.method, req.route?.path || req.path);
    let stat = stats.get(key);
    if (!stat) {
      stat = { count: 0, errors: 0, samples: [] };
      stats.set(key, stat);
    }
    stat.count++;
    if (res.statusCode >= 500) stat.errors++;
    stat.samples.push(duration);
    if (stat.samples.length > MAX_SAMPLES) stat.samples.shift();
  });
  next();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function getMetricsSnapshot() {
  const routes: Array<{
    route: string;
    count: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  }> = [];
  let globalSamples: number[] = [];

  for (const [route, s] of Array.from(stats.entries())) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    globalSamples = globalSamples.concat(s.samples);
    routes.push({
      route,
      count: s.count,
      errors: s.errors,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] || 0,
    });
  }
  routes.sort((a, b) => b.count - a.count);

  const sortedAll = globalSamples.sort((a, b) => a - b);
  return {
    totals: {
      requests: totalRequests,
      errors: totalErrors,
      status429: total429,
      status504: total504,
    },
    overall: {
      p50: percentile(sortedAll, 50),
      p95: percentile(sortedAll, 95),
      p99: percentile(sortedAll, 99),
    },
    routes: routes.slice(0, 50),
  };
}

export function resetMetrics() {
  stats.clear();
  totalRequests = 0;
  totalErrors = 0;
  total429 = 0;
  total504 = 0;
}
