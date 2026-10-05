import { Injectable, Logger } from "@nestjs/common";
import { RegistrationRepository } from "../../registration/application/ports/registration.repository";
import { RegistrationNotFoundError } from "../../registration/application/registration.errors";
import {
  BatchPlatformClient,
  type BurstTicket,
} from "./ports/batch-platform.client";
import { BatchRunStore } from "./ports/batch-run.store";

@Injectable()
export class RequestBatchUseCase {
  private readonly logger = new Logger(RequestBatchUseCase.name);

  constructor(
    private readonly registrations: RegistrationRepository,
    private readonly platform: BatchPlatformClient,
    private readonly runs: BatchRunStore,
  ) {}

  async execute(): Promise<BurstTicket> {
    const registration = await this.registrations.findCurrent();
    if (!registration) throw new RegistrationNotFoundError();

    const ticket = await this.platform.requestBurst(registration);
    this.logger.log(
      `Lote solicitado: run_id=${ticket.runId}, total=${ticket.total}`,
    );

    await this.runs.open({
      ...ticket,
      cid: registration.cid,
      status: "OPEN",
    });
    return ticket;
  }
}
