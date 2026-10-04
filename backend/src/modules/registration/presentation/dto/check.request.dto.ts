import { IsNotEmpty, IsString } from 'class-validator';

export class CheckRequestDto {
  /** Token gerado pela plataforma durante o handshake do /register. */
  @IsString()
  @IsNotEmpty()
  token!: string;
}
