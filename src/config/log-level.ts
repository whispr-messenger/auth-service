import { LogLevel } from '@nestjs/common';

const LOG_LEVEL_MAP: Record<string, LogLevel[]> = {
	error: ['error'],
	warn: ['error', 'warn'],
	log: ['error', 'warn', 'log'],
	debug: ['error', 'warn', 'log', 'debug'],
	verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
};

const DEFAULT_LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log'];

export function getLogLevels(level?: string): LogLevel[] {
	const normalized = level?.trim().toLowerCase();
	if (!normalized || !LOG_LEVEL_MAP[normalized]) {
		return DEFAULT_LOG_LEVELS;
	}
	return LOG_LEVEL_MAP[normalized];
}
