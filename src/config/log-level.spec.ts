import { getLogLevels } from './log-level';

describe('getLogLevels', () => {
	it('should return error levels for "error"', () => {
		expect(getLogLevels('error')).toEqual(['error']);
	});

	it('should return error and warn levels for "warn"', () => {
		expect(getLogLevels('warn')).toEqual(['error', 'warn']);
	});

	it('should return error, warn, log levels for "log"', () => {
		expect(getLogLevels('log')).toEqual(['error', 'warn', 'log']);
	});

	it('should return error, warn, log, debug levels for "debug"', () => {
		expect(getLogLevels('debug')).toEqual(['error', 'warn', 'log', 'debug']);
	});

	it('should return all levels for "verbose"', () => {
		expect(getLogLevels('verbose')).toEqual(['error', 'warn', 'log', 'debug', 'verbose']);
	});

	it('should be case-insensitive', () => {
		expect(getLogLevels('DEBUG')).toEqual(['error', 'warn', 'log', 'debug']);
		expect(getLogLevels('Warn')).toEqual(['error', 'warn']);
	});

	it('should trim whitespace', () => {
		expect(getLogLevels('  debug  ')).toEqual(['error', 'warn', 'log', 'debug']);
	});

	it('should return default levels for undefined', () => {
		expect(getLogLevels(undefined)).toEqual(['error', 'warn', 'log']);
	});

	it('should return default levels for empty string', () => {
		expect(getLogLevels('')).toEqual(['error', 'warn', 'log']);
	});

	it('should return default levels for invalid value', () => {
		expect(getLogLevels('trace')).toEqual(['error', 'warn', 'log']);
		expect(getLogLevels('info')).toEqual(['error', 'warn', 'log']);
	});
});
