import { Controller, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestBatchUseCase } from '../../application/request-batch.use-case';
import { ResendBatchCallbackUseCase } from '../../application/resend-batch-callback.use-case';
import type { RepublishOutcome } from '../../application/ports/enrichment-job.publisher';
import { BatchResponseDto } from '../dto/batch.response.dto';
import { BatchExceptionFilter } from '../filters/batch-exception.filter';

/** Operação manual: pede um lote à plataforma, que passa a chamar nosso /process. */
@ApiTags('batch')
@UseFilters(BatchExceptionFilter)
@Controller('batches')
export class BatchController {
  constructor(
    private readonly requestBatch: RequestBatchUseCase,
    private readonly resendCallback: ResendBatchCallbackUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Solicita um lote (POST /burst/:cid da plataforma)' })
  @ApiResponse({ status: 201, type: BatchResponseDto })
  @ApiResponse({ status: 409, description: 'Serviço ainda não registrado' })
  @ApiResponse({ status: 502, description: 'Plataforma indisponível ou resposta fora do contrato' })
  request(): Promise<BatchResponseDto> {
    return this.requestBatch.execute();
  }

  @Post(':runId/callback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenvia o callback de um lote concluído (gera um novo relatório)' })
  @ApiResponse({ status: 202, description: 'Callback agendado (added/retried) ou já na fila (already_queued)' })
  @ApiResponse({ status: 404, description: 'Lote não encontrado' })
  @ApiResponse({ status: 409, description: 'Lote ainda não concluído' })
  async resend(@Param('runId') runId: string): Promise<{ outcome: RepublishOutcome }> {
    return { outcome: await this.resendCallback.execute(runId) };
  }
}
