/** A plataforma não conseguiu validar nosso webhook (POST <webhook>/check). Contrato: 422 handshake_failed. */
export class HandshakeFailedError extends Error {
  constructor(readonly reason: string) {
    super(`Platform handshake failed: ${reason}`);
    this.name = 'HandshakeFailedError';
  }
}

/** O serviço ainda não foi registrado na plataforma. */
export class RegistrationNotFoundError extends Error {
  constructor() {
    super('Service is not registered yet');
    this.name = 'RegistrationNotFoundError';
  }
}

/** Falha de transporte ou resposta fora do contrato ao falar com a plataforma. */
export class PlatformUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PlatformUnavailableError';
  }
}
