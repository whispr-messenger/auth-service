import * as crypto from 'crypto';
import * as fs from 'fs';

export interface JwtKeysConfig {
	jwtPrivateKey: string;
	jwtPublicKey: string;
}

export function validateJwtKeys(config: Record<string, unknown>): JwtKeysConfig {
	const privateKeyFile = config['JWT_PRIVATE_KEY_FILE'] as string | undefined;
	const publicKeyFile = config['JWT_PUBLIC_KEY_FILE'] as string | undefined;

	if (!privateKeyFile) {
		throw new Error('JWT_PRIVATE_KEY_FILE is not set');
	}
	if (!publicKeyFile) {
		throw new Error('JWT_PUBLIC_KEY_FILE is not set');
	}

	let privateKeyPem: string;
	let publicKeyPem: string;

	try {
		privateKeyPem = fs.readFileSync(privateKeyFile, 'utf8').trim();
	} catch {
		throw new Error(`Cannot read JWT private key file at ${privateKeyFile}`);
	}

	try {
		publicKeyPem = fs.readFileSync(publicKeyFile, 'utf8').trim();
	} catch {
		throw new Error(`Cannot read JWT public key file at ${publicKeyFile}`);
	}

	if (!privateKeyPem) {
		throw new Error(`JWT private key file at ${privateKeyFile} is empty`);
	}
	if (!publicKeyPem) {
		throw new Error(`JWT public key file at ${publicKeyFile} is empty`);
	}

	try {
		crypto.createPrivateKey(privateKeyPem);
	} catch {
		throw new Error(`JWT private key at ${privateKeyFile} is not a valid EC private key`);
	}

	try {
		crypto.createPublicKey(publicKeyPem);
	} catch {
		throw new Error(`JWT public key at ${publicKeyFile} is not a valid EC public key`);
	}

	return {
		...config,
		jwtPrivateKey: privateKeyPem,
		jwtPublicKey: publicKeyPem,
	} as unknown as JwtKeysConfig;
}
