import type { Registration } from '../domain/registration';

/**
 * Saída dos casos de uso: o registro sem o token.
 * Quem precisa da credencial (ex.: batch-processing) lê pelo RegistrationRepository.
 */
export interface RegistrationOutput {
  readonly cid: string;
  readonly name: string;
  readonly webhook: string;
  readonly registeredAt: Date;
}

/** Copia só os campos permitidos: um campo novo em Registration não vaza sem ser listado aqui. */
export function toRegistrationOutput(registration: Registration): RegistrationOutput {
  const { cid, name, webhook, registeredAt } = registration;
  return { cid, name, webhook, registeredAt };
}
