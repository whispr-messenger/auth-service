import { Controller, Get, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  @Get()
  async check() {
    console.log('Health check started');
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        cache: 'unknown',
      },
    };

    // Check database connection
    try {
      console.log('Checking database connection');
      await this.dataSource.query('SELECT 1');
      health.services.database = 'healthy';
      console.log('Database check passed');
    } catch (error) {
      console.log('Database check failed:', error.message);
      health.services.database = 'unhealthy';
      health.status = 'error';
    }

    // Check cache connection
    try {
      console.log('Checking cache connection');
      await this.cacheManager.set('health-check', 'ok', 1000);
      await this.cacheManager.get('health-check');
      health.services.cache = 'healthy';
      console.log('Cache check passed');
    } catch (error) {
      console.log('Cache check failed:', error.message);
      health.services.cache = 'unhealthy';
      health.status = 'error';
    }

    console.log('Health check completed:', health);
    return health;
  }

  @Get('ready')
  async readiness() {
    try {
      await this.dataSource.query('SELECT 1');
      await this.cacheManager.set('readiness-check', 'ok', 1000);
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready', error: error.message };
    }
  }

  @Get('live')
  alive() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }
}
