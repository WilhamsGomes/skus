import { Body, Controller, Get, Post, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentRegistrationUseCase } from '../../application/get-current-registration.use-case';
import { RegisterWebhookUseCase } from '../../application/register-webhook.use-case';
import { RegisterWebhookRequestDto } from '../dto/register-webhook.request.dto';
import { RegistrationResponseDto } from '../dto/registration.response.dto';
import { RegistrationExceptionFilter } from '../filters/registration-exception.filter';

/** Operação manual: dispara o registro deste serviço na plataforma. */
@ApiTags('registration')
@UseFilters(RegistrationExceptionFilter)
@Controller('registration')
export class RegistrationController {
  constructor(
    private readonly registerWebhook: RegisterWebhookUseCase,
    private readonly getCurrentRegistration: GetCurrentRegistrationUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registra o webhook na plataforma e salva cid/token' })
  @ApiResponse({ status: 201, type: RegistrationResponseDto })
  @ApiResponse({ status: 422, description: 'A plataforma não validou o /check (handshake_failed)' })
  @ApiResponse({ status: 502, description: 'Plataforma indisponível ou resposta fora do contrato' })
  register(@Body() dto: RegisterWebhookRequestDto): Promise<RegistrationResponseDto> {
    return this.registerWebhook.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Registro vigente (sem o token)' })
  @ApiResponse({ status: 200, type: RegistrationResponseDto })
  @ApiResponse({ status: 404, description: 'Serviço ainda não registrado' })
  current(): Promise<RegistrationResponseDto> {
    return this.getCurrentRegistration.execute();
  }
}
