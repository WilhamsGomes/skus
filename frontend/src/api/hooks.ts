import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  BurstTicket,
  CacheSnapshot,
  DeliveryDetail,
  DeliveryRow,
  ItemRow,
  ItemStatus,
  Overview,
  Page,
  QueueSnapshot,
  Registration,
  RegistrationRow,
  RepublishOutcome,
  RunDetail,
  RunSummary,
} from "./types";

export const REFRESH_INTERVAL_MS = 60_000;
export const RUN_IN_PROGRESS_REFRESH_MS = 3_000;
const RUN_FAST_REFRESH_WINDOW_MS = 5 * 60_000;

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => api<Overview>("/dashboard/overview"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useRuns(limit: number, offset: number) {
  return useQuery({
    queryKey: ["runs", limit, offset],
    queryFn: () => api<Page<RunSummary>>(`/dashboard/runs${toQuery({ limit, offset })}`),
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api<RunDetail>(`/dashboard/runs/${encodeURIComponent(runId)}`),
    refetchInterval: (query) =>
      isRunInProgress(query.state.data) ? RUN_IN_PROGRESS_REFRESH_MS : REFRESH_INTERVAL_MS,
  });
}

export function isRunInProgress(run: RunDetail | undefined, now = Date.now()): boolean {
  if (!run || run.callbackSentAt) return false;
  return now - new Date(run.startedAt).getTime() < RUN_FAST_REFRESH_WINDOW_MS;
}

export interface ItemFilters {
  runId?: string;
  status?: ItemStatus;
  search?: string;
  limit: number;
  offset: number;
}

export function useItems(filters: ItemFilters) {
  return useQuery({
    queryKey: ["items", filters],
    queryFn: () => api<Page<ItemRow>>(`/dashboard/items${toQuery({ ...filters })}`),
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });
}

export function useQueues() {
  return useQuery({
    queryKey: ["queues"],
    queryFn: () => api<QueueSnapshot[]>("/dashboard/queues"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useCache() {
  return useQuery({
    queryKey: ["cache"],
    queryFn: () => api<CacheSnapshot>("/dashboard/cache"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useDeliveries(limit: number, offset: number) {
  return useQuery({
    queryKey: ["deliveries", limit, offset],
    queryFn: () => api<Page<DeliveryRow>>(`/dashboard/deliveries${toQuery({ limit, offset })}`),
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });
}

export function useDelivery(id: number | null) {
  return useQuery({
    queryKey: ["delivery", id],
    queryFn: () => api<DeliveryDetail>(`/dashboard/deliveries/${id}`),
    enabled: id !== null,
  });
}

export function useRegistrations() {
  return useQuery({
    queryKey: ["registrations"],
    queryFn: () => api<RegistrationRow[]>("/dashboard/registrations"),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useRequestBatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<BurstTicket>("/batches", { method: "POST" }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useResendCallback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api<{ outcome: RepublishOutcome }>(`/batches/${encodeURIComponent(runId)}/callback`, {
        method: "POST",
      }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; webhook: string }) =>
      api<Registration>("/registration", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => client.invalidateQueries(),
  });
}
