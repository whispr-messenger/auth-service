import * as crypto from 'crypto';
import * as fs from 'fs';
import { validateJwtKeys } from './jwt-keys.config';

jest.mock('fs');

// Generate a fresh ephemeral EC key pair for tests — never commit real keys
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const VALID_PRIVATE_KEY = privateKey.export({ type: 'sec1', format: 'pem' }) as string;
const VALID_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }) as string;

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

		expect(result.jwtPrivateKey).toBe(VALID_PRIVATE_KEY.trim());
		expect(result.jwtPublicKey).toBe(VALID_PUBLIC_KEY.trim());
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
