import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { ReceiveBatchItemUseCase } from '../../application/receive-batch-item.use-case';
import { ProcessRequestDto } from '../dto/process.request.dto';
import { ProcessResponseDto } from '../dto/process.response.dto';

@Public()
@ApiTags('platform webhook')
@Controller('process')
export class ProcessController {
  constructor(private readonly receiveBatchItem: ReceiveBatchItemUseCase) {}

  /**
   * ACK: responde assim que o item está gravado. Duplicata também recebe 200, senão a plataforma reenviaria.
   * Se o insert falhar, o 500 é intencional: sem ACK a plataforma reentrega (at-least-once) e nada se perde.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe uma mensagem do lote (ACK rápido, processamento assíncrono)' })
  @ApiResponse({ status: 200, type: ProcessResponseDto })
  async process(@Body() dto: ProcessRequestDto): Promise<ProcessResponseDto> {
    await this.receiveBatchItem.execute({ runId: dto.run_id, seq: dto.seq, sku: dto.sku });
    return { ok: true };
  }
}
