import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export const ApiHealthCheckEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Check service health',
			description: 'Returns a minimal public health status. No runtime metadata is exposed.',
		}),
		ApiResponse({ status: 200, description: 'Health check completed successfully' }),
		ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
	);

export const ApiReadinessEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Check service readiness',
			description: 'Returns whether the service is ready to accept traffic',
		}),
		ApiResponse({ status: 200, description: 'Service is ready' }),
		ApiResponse({ status: 503, description: 'Service is not ready' })
	);

export const ApiLivenessEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Check service liveness',
			description:
				'Returns whether the process is alive. This is a lightweight probe that does not check external dependencies — use /health/ready for dependency checks.',
		}),
		ApiResponse({ status: 200, description: 'Service is alive' })
	);
