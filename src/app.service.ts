import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      message: 'Code en ligne Backend API is running',
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return {
      api: 'Code en ligne Backend',
      version: '1.0.0',
      status: 'healthy',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
