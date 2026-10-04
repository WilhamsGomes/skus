import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class RegisterWebhookRequestDto {
  /** Nome exibido nos relatórios da plataforma. */
  @IsString()
  @IsNotEmpty()
  name!: string;

  /**
   * URL pública HTTPS deste serviço (ex.: túnel ngrok), sem o path /check.
   * @example https://xxxx.ngrok.app
   */
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhook!: string;
}
