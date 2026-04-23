import { Controller, Get, Post, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../tokens/guards/jwt-auth.guard';
import { SignalKeySchedulerService } from '../services/signal-key-scheduler.service';
import { PreKeyRepository } from '../repositories';
import { SignalHealthStatusDto, CleanupResultDto } from '../dto';
import {
	ApiGetSignalHealthEndpoint,
	ApiTriggerManualCleanupEndpoint,
} from './signal-keys-health.controller.swagger';

/**
 * Health check and monitoring endpoint for Signal Protocol keys
 *
 * Provides operational visibility into:
 * - Scheduler job execution status
 * - System-wide prekey availability
 * - Key rotation status
 */
@ApiTags('Signal Protocol - Health & Monitoring')
@Controller('signal/health')
export class SignalKeysHealthController {
	private readonly logger = new Logger(SignalKeysHealthController.name);

	constructor(
		private readonly schedulerService: SignalKeySchedulerService,
		private readonly preKeyRepository: PreKeyRepository
	) {}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiGetSignalHealthEndpoint()
	async getHealth(): Promise<SignalHealthStatusDto> {
		this.logger.debug('Health check requested');

		const schedulerStats = this.schedulerService.getSchedulerStats();

		// Get prekey statistics
		const totalUnused = await this.preKeyRepository.count({
			where: { isUsed: false },
		});

		const devicesGrouped = await this.preKeyRepository
			.createQueryBuilder('prekey')
			.select('prekey.userId', 'userId')
			.addSelect('prekey.deviceId', 'deviceId')
			.addSelect('COUNT(*)', 'count')
			.where('prekey.isUsed = false')
			.groupBy('prekey.userId')
			.addGroupBy('prekey.deviceId')
			.getRawMany();

		const devicesWithLowPrekeys = devicesGrouped.filter((d) => Number.parseInt(d.count, 10) < 20).length;

		const devicesWithNoPrekeys = devicesGrouped.filter((d) => Number.parseInt(d.count, 10) === 0).length;

		// Determine overall health status
		const issues: string[] = [];

		if (!schedulerStats.isHealthy) {
			issues.push('Scheduler jobs not running as expected');
		}

		if (devicesWithNoPrekeys > 0) {
			issues.push(
				`${devicesWithNoPrekeys} devices have no available prekeys (cannot initiate conversations)`
			);
		}

		if (devicesWithLowPrekeys > 10) {
			issues.push(`${devicesWithLowPrekeys} devices have low prekey counts (< 20)`);
		}

		if (totalUnused < 1000) {
			issues.push(`System-wide prekey count is low (${totalUnused} total unused)`);
		}

		let status: 'healthy' | 'degraded' | 'unhealthy';
		if (devicesWithNoPrekeys > 0 || !schedulerStats.isHealthy) {
			status = 'unhealthy';
		} else if (issues.length > 0) {
			status = 'degraded';
		} else {
			status = 'healthy';
		}

		this.logger.log(`Health check completed: ${status} (${issues.length} issues)`);

		return {
			status,
			timestamp: new Date(),
			scheduler: schedulerStats,
			prekeys: {
				totalUnused,
				devicesWithLowPrekeys,
				devicesWithNoPrekeys,
			},
			issues,
		};
	}

	@Post('cleanup')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiTriggerManualCleanupEndpoint()
	async triggerManualCleanup(): Promise<CleanupResultDto> {
		this.logger.log('Manual cleanup triggered via API');

		const result = await this.schedulerService.manualCleanup();

		return {
			message: 'Cleanup completed successfully',
			expiredKeysDeleted: result.expiredKeysDeleted,
			oldPreKeysDeleted: result.oldPreKeysDeleted,
		};
	}
}
