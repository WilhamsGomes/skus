import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { CheckRequestDto } from '../dto/check.request.dto';
import { CheckResponseDto } from '../dto/check.response.dto';

@Public()
@ApiTags('platform webhook')
@Controller('check')
export class CheckController {
  /**
   * Eco do token é o próprio contrato do handshake, sem regra de negócio, por isso não há caso de uso.
   * Não confere com credenciais salvas: a plataforma chama /check durante o /register, antes de termos o token.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handshake do webhook: devolve o token recebido' })
  @ApiResponse({ status: 200, type: CheckResponseDto })
  check(@Body() dto: CheckRequestDto): CheckResponseDto {
    return { token: dto.token };
  }
}
