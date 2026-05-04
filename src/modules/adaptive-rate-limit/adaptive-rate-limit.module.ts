import { Module } from '@nestjs/common';
import { AdaptiveRateLimitService } from './adaptive-rate-limit.service';
import { AdaptiveRateLimitInterceptor } from './adaptive-rate-limit.interceptor';

// WHISPR-1054: CacheModule is already @Global(), so CacheService injects here
// without an explicit import.
@Module({
	providers: [AdaptiveRateLimitService, AdaptiveRateLimitInterceptor],
	exports: [AdaptiveRateLimitService, AdaptiveRateLimitInterceptor],
})
export class AdaptiveRateLimitModule {}
