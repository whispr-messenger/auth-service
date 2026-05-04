import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	SIGNAL_HEALTH_STATUS_SCHEMA,
	SIGNAL_HEALTH_STATUS_EXAMPLES,
	CLEANUP_RESULT_SCHEMA,
	CLEANUP_RESULT_EXAMPLES,
} from '../swagger/signal-keys-health.schemas';
import { SignalHealthStatusDto, CleanupResultDto } from '../dto';

export const ApiGetSignalHealthEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Get Signal keys health status',
			description:
				'Returns comprehensive health information about the Signal Protocol key management system',
		}),
		ApiResponse({
			status: 200,
			description: 'Health status retrieved successfully',
			type: SignalHealthStatusDto,
			schema: SIGNAL_HEALTH_STATUS_SCHEMA,
			examples: SIGNAL_HEALTH_STATUS_EXAMPLES,
		})
	);

export const ApiTriggerManualCleanupEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({
			summary: 'Manually trigger cleanup',
			description:
				'Triggers manual cleanup of expired keys and old prekeys. Useful for testing or immediate cleanup needs.',
		}),
		ApiResponse({
			status: 200,
			description: 'Cleanup completed successfully',
			type: CleanupResultDto,
			schema: CLEANUP_RESULT_SCHEMA,
			examples: CLEANUP_RESULT_EXAMPLES,
		}),
		ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
	);
