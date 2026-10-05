import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ReconcileStaleWorkUseCase } from "../../application/reconcile-stale-work.use-case";

export const RECONCILE_EVERY_MS = 30_000;

@Injectable()
export class StaleWorkReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StaleWorkReconciler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly reconcile: ReconcileStaleWorkUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), RECONCILE_EVERY_MS);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { requeuedItems, closedRuns, requeuedCallbacks } = await this.reconcile.execute();
      if (requeuedItems + closedRuns + requeuedCallbacks > 0) {
        this.logger.log(
          `Reprocessamento: ${requeuedItems} itens, ${closedRuns} lotes fechados, ${requeuedCallbacks} callbacks`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Reprocessamento falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
