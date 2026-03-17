import { Injectable } from '@nestjs/common';

type HealthCheckResponse = {
  status: 'ok';
  service: 'lastmile-backend';
};

@Injectable()
export class AppService {
  getHealthCheck(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'lastmile-backend',
    };
  }
}
