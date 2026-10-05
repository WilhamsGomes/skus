import { useNavigate } from "react-router-dom";
import { useRequestBatch } from "../../api/hooks";
import { useToast } from "../ui/Toaster";

export function useRequestBatchAction() {
  const mutation = useRequestBatch();
  const { notify } = useToast();
  const navigate = useNavigate();

  const requestBatch = () =>
    mutation.mutate(undefined, {
      onSuccess: (ticket) => {
        notify("success", `Lote solicitado: ${ticket.total} itens`, `run_id ${ticket.runId}`);
        navigate(`/runs/${ticket.runId}`);
      },
      onError: (error) => notify("error", "Não foi possível solicitar o lote", error.message),
    });

  return { requestBatch, isPending: mutation.isPending };
}
