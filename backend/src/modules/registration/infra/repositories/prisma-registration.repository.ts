import { Injectable } from "@nestjs/common";
import type { Registration as RegistrationRow } from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../shared/infra/prisma/prisma.service";
import type { Registration } from "../../domain/registration";
import type { RegistrationRepository } from "../../application/ports/registration.repository";

@Injectable()
export class PrismaRegistrationRepository implements RegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(registration: Registration): Promise<void> {
    const { cid, token, name, webhook, registeredAt } = registration;
    await this.prisma.registration.create({
      data: { cid, token, name, webhook, registeredAt },
    });
  }

  async findCurrent(): Promise<Registration | null> {
    const row = await this.prisma.registration.findFirst({
      orderBy: { registeredAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  async findByCid(cid: string): Promise<Registration | null> {
    const row = await this.prisma.registration.findUnique({ where: { cid } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: RegistrationRow): Registration {
  return {
    cid: row.cid,
    token: row.token,
    name: row.name,
    webhook: row.webhook,
    registeredAt: row.registeredAt,
  };
}
