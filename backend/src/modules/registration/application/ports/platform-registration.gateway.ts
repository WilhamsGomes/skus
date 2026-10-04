import type { PlatformCredentials } from '../../domain/registration';

/** Saída para o POST /register da plataforma. Classe abstrata para servir de token de injeção. */
export abstract class PlatformRegistrationGateway {
  /**
   * Durante esta chamada a plataforma faz POST <webhook>/check; o serviço precisa estar no ar.
   * @throws HandshakeFailedError quando a plataforma responde 422.
   * @throws PlatformUnavailableError em erro de rede, timeout ou resposta inesperada.
   */
  abstract register(input: { name: string; webhook: string }): Promise<PlatformCredentials>;
}
