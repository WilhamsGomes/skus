import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/infra/prisma/prisma.service";

export interface RegistrationRow {
  readonly cid: string;
  readonly name: string;
  readonly webhook: string;
  readonly registeredAt: Date;
  readonly current: boolean;
  readonly runs: number;
}

@Injectable()
export class RegistrationsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RegistrationRow[]> {
    const [rows, runsByCid] = await Promise.all([
      this.prisma.registration.findMany({
        orderBy: { registeredAt: "desc" },
        select: { cid: true, name: true, webhook: true, registeredAt: true },
      }),
      this.prisma.batchRun.groupBy({ by: ["cid"], _count: { _all: true } }),
    ]);
    const runs = new Map(runsByCid.map((group) => [group.cid, group._count._all]));

    return rows.map((row, index) => ({ ...row, current: index === 0, runs: runs.get(row.cid) ?? 0 }));
  }
}
