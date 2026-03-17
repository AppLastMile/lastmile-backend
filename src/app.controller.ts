import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealthCheck(): { status: 'ok'; service: 'lastmile-backend' } {
    return this.appService.getHealthCheck();
  }
}
