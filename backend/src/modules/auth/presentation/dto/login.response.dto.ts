import type { LoginOutput } from "../../application/login.use-case";

export class LoginResponseDto implements LoginOutput {
  accessToken!: string;
  expiresIn!: number;
  username!: string;
}
