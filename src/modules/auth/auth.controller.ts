import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.authService.loginWithGoogle(dto.accessToken);
  }
}
