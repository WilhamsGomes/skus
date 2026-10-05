import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../shared/infra/prisma/prisma.service";
import type { Page, RunItem } from "./runs.query";

export type ItemStatus = "RECEIVED" | "ENRICHED" | "FAILED";

export interface ItemFilter {
  readonly runId?: string;
  readonly status?: ItemStatus;
  readonly search?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ItemRow extends RunItem {
  readonly runId: string;
}

@Injectable()
export class ItemsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ItemFilter): Promise<Page<ItemRow>> {
    const where: Prisma.BatchItemWhereInput = {
      ...(filter.runId ? { runId: filter.runId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search ? { sku: { contains: filter.search, mode: "insensitive" } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.batchItem.findMany({
        where,
        orderBy: [{ receivedAt: "desc" }, { seq: "asc" }],
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.batchItem.count({ where }),
    ]);

    return {
      total,
      data: rows.map((row) => ({
        runId: row.runId,
        seq: row.seq,
        sku: row.sku,
        status: row.status,
        price: row.price,
        stock: row.stock,
        attempts: row.attempts,
        lastError: row.lastError,
        receivedAt: row.receivedAt,
        updatedAt: row.updatedAt,
      })),
    };
  }
}
