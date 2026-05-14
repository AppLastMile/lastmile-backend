import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'tok', user: {} }),
  };
  const controller = new AuthController(mockAuthService as any);

  beforeEach(() => jest.clearAllMocks());

  it('calls authService.login with dto and returns result', async () => {
    const dto = { email: 'a@b.com', password: 'pass' };
    const result = await controller.login(dto);
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    expect(result.accessToken).toBe('tok');
  });
});
