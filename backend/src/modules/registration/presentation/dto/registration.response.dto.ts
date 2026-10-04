import type { RegistrationOutput } from '../../application/registration.output';

/** Formato da resposta HTTP (documentado no Swagger). O token já não sai dos casos de uso. */
export class RegistrationResponseDto implements RegistrationOutput {
  cid!: string;
  name!: string;
  webhook!: string;
  registeredAt!: Date;
}
