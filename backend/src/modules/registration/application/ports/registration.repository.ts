import type { Registration } from '../../domain/registration';

/**
 * Persistência das credenciais. Exportada pelo módulo para quem precisar autenticar na plataforma.
 * Classe abstrata (e não interface) para existir em runtime e servir de token de injeção.
 */
export abstract class RegistrationRepository {
  abstract save(registration: Registration): Promise<void>;
  /** Registro mais recente; `null` se o serviço nunca foi registrado. */
  abstract findCurrent(): Promise<Registration | null>;
}
