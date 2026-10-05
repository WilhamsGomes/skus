import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../shared/infra/prisma/prisma.service";
import type { ReceivedItem } from "../../domain/received-item";
import type { BatchItemInbox } from "../../application/ports/batch-item.inbox";

@Injectable()
export class PrismaBatchItemInbox implements BatchItemInbox {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfNew(item: ReceivedItem): Promise<boolean> {
    const { count } = await this.prisma.batchItem.createMany({
      data: [{ runId: item.runId, seq: item.seq, sku: item.sku }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}
