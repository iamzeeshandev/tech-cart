import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'API and database check (no Stripe call)' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  @ApiServiceUnavailableResponse({ description: 'Postgres is unreachable' })
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up' };
  }
}
