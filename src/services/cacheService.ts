import { AIResponseContract, PersonaId } from "../types/domain";

export interface CacheKeyInput {
  tenantId: string;
  personaId: PersonaId;
  scopedSalonIds: string[];
  metricIdsAndVersions: string[];
  normalizedQueryIntent: string;
  dateRange: string;
  analysisMode: "fast" | "deep";
  dataVersion: number;
}

export interface StoredCacheRecord {
  cacheKey: string;
  tenantId: string;
  personaId: PersonaId;
  scopeSummary: string;
  queryIntent: string;
  dataVersion: number;
  createdAt: string;
  hitCount: number;
  baselineTokensPerExecution: number;
  estimatedTokensSavedTotal: number;
  response: AIResponseContract;
}

class ScopedQueryCacheService {
  private store = new Map<string, StoredCacheRecord>();
  private totalHits = 0;
  private totalLookups = 0;

  public buildCompositeKey(input: CacheKeyInput): string {
    const sortedSalons = [...input.scopedSalonIds].sort().join(",");
    const sortedMetrics = [...input.metricIdsAndVersions].sort().join(",");
    return [
      `tenant:${input.tenantId}`,
      `role:${input.personaId}`,
      `scope:${sortedSalons}`,
      `kpis:${sortedMetrics}`,
      `intent:${input.normalizedQueryIntent.toLowerCase().trim()}`,
      `range:${input.dateRange}`,
      `mode:${input.analysisMode}`,
      `dv:${input.dataVersion}`,
    ].join("|");
  }

  public lookup(
    input: CacheKeyInput,
    bypassCache: boolean
  ): AIResponseContract | null {
    this.totalLookups += 1;
    if (bypassCache) return null;

    const key = this.buildCompositeKey(input);
    const existing = this.store.get(key);
    if (!existing) return null;

    // Never reuse across tenants or mismatched dataVersion
    if (
      existing.tenantId !== input.tenantId ||
      existing.personaId !== input.personaId ||
      existing.dataVersion !== input.dataVersion
    ) {
      return null;
    }

    this.totalHits += 1;
    existing.hitCount += 1;
    existing.estimatedTokensSavedTotal += existing.baselineTokensPerExecution;

    return {
      ...existing.response,
      lastAnalysisTimestamp:
        new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      calculationDetails: {
        ...existing.response.calculationDetails,
        executionSource: "Certified Cache Reused",
        cacheStatusBanner:
          "Reused certified calculation — no new deep analysis required.",
        tokensUsed: 0,
        estimatedCostUsd: 0,
        latencyMs: 24,
        isSimulatedTokenEstimate: true,
      },
    };
  }

  public put(
    input: CacheKeyInput,
    response: AIResponseContract,
    baselineTokens: number
  ): string {
    const key = this.buildCompositeKey(input);
    this.store.set(key, {
      cacheKey: key,
      tenantId: input.tenantId,
      personaId: input.personaId,
      scopeSummary: `${input.scopedSalonIds.length} salons`,
      queryIntent: input.normalizedQueryIntent,
      dataVersion: input.dataVersion,
      createdAt:
        new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      hitCount: 0,
      baselineTokensPerExecution: baselineTokens,
      estimatedTokensSavedTotal: 0,
      response,
    });
    return key;
  }

  public invalidateStaleVersions(activeDataVersion: number): number {
    let purged = 0;
    for (const [k, rec] of this.store.entries()) {
      if (rec.dataVersion !== activeDataVersion) {
        this.store.delete(k);
        purged += 1;
      }
    }
    return purged;
  }

  public getObservabilityStats() {
    const entries = Array.from(this.store.values());
    const estimatedTokensSaved = entries.reduce(
      (sum, e) => sum + e.estimatedTokensSavedTotal,
      0
    );
    const hitRatePct =
      this.totalLookups === 0
        ? 37.5
        : Number(((this.totalHits / this.totalLookups) * 100).toFixed(1));
    return {
      activeEntriesCount: entries.length,
      totalLookups: this.totalLookups,
      totalHits: this.totalHits,
      hitRatePct,
      estimatedTokensSaved,
      entries,
    };
  }
}

export const queryCacheService = new ScopedQueryCacheService();
