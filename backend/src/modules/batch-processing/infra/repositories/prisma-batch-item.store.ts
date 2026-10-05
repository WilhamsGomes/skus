import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/infra/prisma/prisma.service";
import type { EnrichmentResult } from "../../domain/enrichment-result";
import type {
  BatchItemRef,
  BatchItemStore,
  CallbackItem,
  StaleItem,
  StaleItemQuery,
} from "../../application/ports/batch-item.store";

@Injectable()
export class PrismaBatchItemStore implements BatchItemStore {
  constructor(private readonly prisma: PrismaService) {}

  async markEnriched(
    item: BatchItemRef,
    result: EnrichmentResult,
  ): Promise<boolean> {
    const { count } = await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: {
        status: "ENRICHED",
        price: result.price,
        stock: result.stock,
        lastError: null,
        attempts: { increment: 1 },
      },
    });
    return count === 1;
  }

  async markFailed(item: BatchItemRef, reason: string): Promise<boolean> {
    const { count } = await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: { status: "FAILED", lastError: reason, attempts: { increment: 1 } },
    });
    return count === 1;
  }

  async listForCallback(runId: string): Promise<CallbackItem[]> {
    const rows = await this.prisma.batchItem.findMany({
      where: { runId },
      orderBy: { seq: "asc" },
      select: { seq: true, sku: true, status: true, price: true, stock: true },
    });
    return rows.map(({ seq, sku, status, price, stock }) =>
      status === "ENRICHED"
        ? { seq, sku, price, stock }
        : { seq, sku, price: null, stock: null },
    );
  }

  findStale({
    updatedBefore,
    maxAttempts,
    limit,
  }: StaleItemQuery): Promise<StaleItem[]> {
    return this.prisma.batchItem.findMany({
      where: {
        status: "RECEIVED",
        updatedAt: { lt: updatedBefore },
        attempts: { lt: maxAttempts },
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: { runId: true, seq: true, sku: true },
    });
  }

  async recordFailedAttempt(item: BatchItemRef, reason: string): Promise<void> {
    await this.prisma.batchItem.updateMany({
      where: { ...item, status: "RECEIVED" },
      data: { lastError: reason, attempts: { increment: 1 } },
    });
  }
}
