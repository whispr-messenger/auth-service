import * as fs from 'fs';
import { validateJwtKeys } from './jwt-keys.config';

jest.mock('fs');

const VALID_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbziHa/xFA+np4yxov/eARnnTYTOxY/ukqGhSOkfMoboAoGCCqGSM49
AwEHoUQDQgAEIDUdceFHvmbx6lUNwciNRmyJqpAakLzZzdPgcgDVf10YHfiaprI0
fir7QKxkq7dr1AlUUpYdbkOmYmfXnqk1Ag==
-----END EC PRIVATE KEY-----`;

const VALID_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIDUdceFHvmbx6lUNwciNRmyJqpAa
kLzZzdPgcgDVf10YHfiaprI0fir7QKxkq7dr1AlUUpYdbkOmYmfXnqk1Ag==
-----END PUBLIC KEY-----`;

describe('validateJwtKeys', () => {
	const mockReadFileSync = fs.readFileSync as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns config with parsed key content on valid inputs', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return VALID_PRIVATE_KEY;
			if (path === '/run/secrets/jwt_public_key') return VALID_PUBLIC_KEY;
			throw new Error('Unexpected path');
		});

		const result = validateJwtKeys({
			JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
			JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
		});

		expect(result.jwtPrivateKey).toBe(VALID_PRIVATE_KEY);
		expect(result.jwtPublicKey).toBe(VALID_PUBLIC_KEY);
	});

	it('throws when JWT_PRIVATE_KEY_FILE is missing', () => {
		expect(() =>
			validateJwtKeys({
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('JWT_PRIVATE_KEY_FILE is not set');
	});

	it('throws when JWT_PUBLIC_KEY_FILE is missing', () => {
		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
			})
		).toThrow('JWT_PUBLIC_KEY_FILE is not set');
	});

	it('throws when private key file cannot be read', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') throw new Error('ENOENT');
			return VALID_PUBLIC_KEY;
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('Cannot read JWT private key file');
	});

	it('throws when public key file cannot be read', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return VALID_PRIVATE_KEY;
			throw new Error('ENOENT');
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('Cannot read JWT public key file');
	});

	it('throws when private key file is empty', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return '   ';
			return VALID_PUBLIC_KEY;
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('JWT private key file');
	});

	it('throws when public key file is empty', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return VALID_PRIVATE_KEY;
			return '   ';
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('JWT public key file');
	});

	it('throws when private key is not a valid EC key', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return 'not-a-pem-key';
			return VALID_PUBLIC_KEY;
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('not a valid EC private key');
	});

	it('throws when public key is not a valid EC key', () => {
		mockReadFileSync.mockImplementation((path: string) => {
			if (path === '/run/secrets/jwt_private_key') return VALID_PRIVATE_KEY;
			return 'not-a-pem-key';
		});

		expect(() =>
			validateJwtKeys({
				JWT_PRIVATE_KEY_FILE: '/run/secrets/jwt_private_key',
				JWT_PUBLIC_KEY_FILE: '/run/secrets/jwt_public_key',
			})
		).toThrow('not a valid EC public key');
	});
});
