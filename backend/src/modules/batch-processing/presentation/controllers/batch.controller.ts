import { Controller, Post, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestBatchUseCase } from '../../application/request-batch.use-case';
import { BatchResponseDto } from '../dto/batch.response.dto';
import { BatchExceptionFilter } from '../filters/batch-exception.filter';

/** Operação manual: pede um lote à plataforma, que passa a chamar nosso /process. */
@ApiTags('batch')
@UseFilters(BatchExceptionFilter)
@Controller('batches')
export class BatchController {
  constructor(private readonly requestBatch: RequestBatchUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Solicita um lote (POST /burst/:cid da plataforma)' })
  @ApiResponse({ status: 201, type: BatchResponseDto })
  @ApiResponse({ status: 409, description: 'Serviço ainda não registrado' })
  @ApiResponse({ status: 502, description: 'Plataforma indisponível ou resposta fora do contrato' })
  request(): Promise<BatchResponseDto> {
    return this.requestBatch.execute();
  }
}
