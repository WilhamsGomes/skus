import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { APP_CONFIG, type AppConfig } from "../../shared/config/app-config";
import { LoginUseCase, TOKEN_TTL_SECONDS } from "./application/login.use-case";
import { AuthController } from "./presentation/controllers/auth.controller";
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.authSecret,
        signOptions: { expiresIn: TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AuthModule {}
