export type CheckStatus = "ok" | "error";

export interface DependencyStatus {
  status: CheckStatus;
  latency_ms?: number | null;
  detail?: string | null;
}

export interface HealthResponse {
  status: CheckStatus;
  version: string;
  environment: string;
  checks: Record<string, DependencyStatus>;
}
