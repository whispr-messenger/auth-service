import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { Injectable, OnModuleInit } from '@nestjs/common';
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
	private jwk: JwkKey;

	constructor(private readonly configService: ConfigService) {}

	onModuleInit(): void {
		const publicKeyFile = this.configService.get<string>('JWT_PUBLIC_KEY_FILE')!;
		const pem = fs.readFileSync(publicKeyFile, 'utf8').trim();
		this.jwk = this.buildJwk(pem);
	}

	getJwks(): JwksDocument {
		return { keys: [this.jwk] };
	}

	getKid(): string {
		return this.jwk.kid;
	}

	private buildJwk(pem: string): JwkKey {
		const key = crypto.createPublicKey(pem);
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
