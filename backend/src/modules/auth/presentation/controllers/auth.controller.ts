import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../../shared/auth/public.decorator";
import { InvalidCredentialsError } from "../../application/auth.errors";
import { LoginUseCase } from "../../application/login.use-case";
import { LoginRequestDto } from "../dto/login.request.dto";
import { LoginResponseDto } from "../dto/login.response.dto";
import type { AuthenticatedRequest } from "../guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login do dashboard (usuário e senha fixos)" })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: "Usuário ou senha inválidos" })
  async signIn(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      return await this.login.execute(dto);
    } catch (error) {
      if (error instanceof InvalidCredentialsError)
        throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Get("me")
  @ApiOperation({ summary: "Usuário autenticado" })
  me(@Req() request: AuthenticatedRequest): { username: string } {
    return { username: request.user?.username ?? "" };
  }
}
