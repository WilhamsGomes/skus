import { createHash, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { APP_CONFIG, type AppConfig } from "../../../shared/config/app-config";
import { InvalidCredentialsError } from "./auth.errors";

export const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export interface LoginOutput {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly username: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwt: JwtService,
  ) {}

  async execute(input: {
    username: string;
    password: string;
  }): Promise<LoginOutput> {
    const validUser = safeEqual(input.username, this.config.dashboardUsername);
    const validPassword = safeEqual(
      input.password,
      this.config.dashboardPassword,
    );
    if (!validUser || !validPassword) throw new InvalidCredentialsError();

    const accessToken = await this.jwt.signAsync({ sub: input.username });
    return {
      accessToken,
      expiresIn: TOKEN_TTL_SECONDS,
      username: input.username,
    };
  }
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
