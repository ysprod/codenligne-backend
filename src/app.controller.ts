import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   * Health check endpoint
   */
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  /**
   * GET /status
   * API status endpoint
   */
  @Public()
  @Get('status')
  getStatus() {
    return this.appService.getStatus();
  }
}
