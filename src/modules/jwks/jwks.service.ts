import * as crypto from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface JwkKey {
	kty: 'EC';
	crv: 'P-256';
	kid: string;
	use: 'sig';
	alg: 'ES256';
	x: string;
	y: string;
}

export interface JwksDocument {
	keys: JwkKey[];
}

@Injectable()
export class JwksService implements OnModuleInit {
	private readonly logger = new Logger(JwksService.name);
	private jwk: JwkKey;

	constructor(private readonly configService: ConfigService) {}

	onModuleInit(): void {
		const publicKeyFile = this.configService.get<string>('JWT_PUBLIC_KEY_FILE')!;
		try {
			const pem = this.configService.get<string>('jwtPublicKey')!;
			this.jwk = this.buildJwk(pem, publicKeyFile);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(
				`Failed to initialize JWKS from "${publicKeyFile}": ${error.message}`,
				error.stack
			);
			throw err;
		}
	}

	getJwks(): JwksDocument {
		return { keys: [this.jwk] };
	}

	getKid(): string {
		return this.jwk.kid;
	}

	private buildJwk(pem: string, filePath: string): JwkKey {
		let key: crypto.KeyObject;
		try {
			key = crypto.createPublicKey(pem);
		} catch (err) {
			throw new Error(`"${filePath}" does not contain a valid PEM: ${(err as Error).message}`);
		}

		const keyDetails = key.asymmetricKeyDetails;
		if (key.asymmetricKeyType !== 'ec') {
			throw new Error(
				`"${filePath}" contains a ${key.asymmetricKeyType?.toUpperCase() ?? 'unknown'} key, but EC is required for ES256`
			);
		}

		if (keyDetails?.namedCurve !== 'prime256v1') {
			throw new Error(
				`"${filePath}" uses curve "${keyDetails?.namedCurve ?? 'unknown'}", but P-256 (prime256v1) is required`
			);
		}

		const { x, y } = key.export({ format: 'jwk' }) as { x: string; y: string; kty: string; crv: string };

		// Derive a stable kid from the SHA-256 thumbprint of the raw x||y coordinates
		const thumbprintInput = Buffer.concat([Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]);
		const kid = crypto.createHash('sha256').update(thumbprintInput).digest('base64url').substring(0, 16);

		return {
			kty: 'EC',
			crv: 'P-256',
			kid,
			use: 'sig',
			alg: 'ES256',
			x,
			y,
		};
	}
}
