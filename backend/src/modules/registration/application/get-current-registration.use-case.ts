import { Injectable } from '@nestjs/common';
import { RegistrationRepository } from './ports/registration.repository';
import { RegistrationNotFoundError } from './registration.errors';
import { toRegistrationOutput, type RegistrationOutput } from './registration.output';

/** Registro vigente (o mais recente). */
@Injectable()
export class GetCurrentRegistrationUseCase {
  constructor(private readonly repository: RegistrationRepository) {}

  async execute(): Promise<RegistrationOutput> {
    const registration = await this.repository.findCurrent();
    if (!registration) throw new RegistrationNotFoundError();
    return toRegistrationOutput(registration);
  }
}
