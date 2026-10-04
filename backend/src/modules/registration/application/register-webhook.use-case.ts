import { Injectable } from "@nestjs/common";
import type { Registration } from "../domain/registration";
import { PlatformRegistrationGateway } from "./ports/platform-registration.gateway";
import { RegistrationRepository } from "./ports/registration.repository";
import { toRegistrationOutput, type RegistrationOutput } from "./registration.output";

export interface RegisterWebhookInput {
  name: string;
  /** URL pública HTTPS do serviço. A plataforma chamará `<webhook>/check`. */
  webhook: string;
}

/** Registra o webhook na plataforma e guarda as credenciais devolvidas. */
@Injectable()
export class RegisterWebhookUseCase {
  constructor(
    private readonly gateway: PlatformRegistrationGateway,
    private readonly repository: RegistrationRepository,
  ) {}

  async execute(input: RegisterWebhookInput): Promise<RegistrationOutput> {
    // Sem barra final: a plataforma concatena "/check", e "//check" quebraria o handshake.
    const webhook = input.webhook.replace(/\/+$/, "");
    
    const credentials = await this.gateway.register({
      name: input.name,
      webhook,
    });

    const registration: Registration = {
      ...credentials,
      name: input.name,
      webhook,
      registeredAt: new Date(),
    };
    
    await this.repository.save(registration);
    return toRegistrationOutput(registration);
  }
}
