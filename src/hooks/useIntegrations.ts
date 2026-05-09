import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listIntegrationExchangeLogs,
  listIntegrationOverview,
  testAssureurIntegration,
} from "../lib/ipc";

const INTEGRATIONS_KEY = ["integrations"] as const;
const INTEGRATION_LOGS_KEY = ["integration-exchange-logs"] as const;

export function useIntegrationOverview() {
  return useQuery({
    queryKey: [...INTEGRATIONS_KEY, "overview"],
    queryFn: () => listIntegrationOverview(),
  });
}

export function useIntegrationExchangeLogs(limit = 20) {
  return useQuery({
    queryKey: [...INTEGRATION_LOGS_KEY, limit],
    queryFn: () => listIntegrationExchangeLogs(limit),
  });
}

export function useTestAssureurIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assureurId: number) => testAssureurIntegration(assureurId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [...INTEGRATIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [...INTEGRATION_LOGS_KEY] });
      void qc.invalidateQueries({ queryKey: ["assureurs"] });
    },
  });
}
