import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/** Payload enviado pela plataforma. Nomes em snake_case por contrato. */
export class ProcessRequestDto {
  /** @example clx123 */
  @IsString()
  @IsNotEmpty()
  run_id!: string;

  /** Posição do item no lote. Junto com run_id, identifica a mensagem. @example 7 */
  @IsInt()
  @Min(0)
  seq!: number;

  /** @example sku-001 */
  @IsString()
  @IsNotEmpty()
  sku!: string;
}
