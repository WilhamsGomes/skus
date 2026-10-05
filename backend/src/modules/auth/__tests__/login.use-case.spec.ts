import { JwtService } from '@nestjs/jwt';
import type { AppConfig } from '../../../shared/config/app-config';
import { InvalidCredentialsError } from '../application/auth.errors';
import { LoginUseCase } from '../application/login.use-case';

describe('LoginUseCase', () => {
  const config = { dashboardUsername: 'admin', dashboardPassword: 's3cret' } as AppConfig;
  const jwt = new JwtService({ secret: 'test-secret-with-16+chars' });
  const useCase = new LoginUseCase(config, jwt);

  it('issues a token whose subject is the username', async () => {
    const output = await useCase.execute({ username: 'admin', password: 's3cret' });

    expect(output.username).toBe('admin');
    await expect(jwt.verifyAsync(output.accessToken)).resolves.toMatchObject({ sub: 'admin' });
  });

  it.each([
    ['wrong password', { username: 'admin', password: 'nope' }],
    ['wrong username', { username: 'root', password: 's3cret' }],
    ['password prefix', { username: 'admin', password: 's3cre' }],
  ])('rejects %s', async (_, input) => {
    await expect(useCase.execute(input)).rejects.toThrow(InvalidCredentialsError);
  });
});
