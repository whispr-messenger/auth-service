import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export async function jwtModuleOptionsFactory(configService: ConfigService): Promise<JwtModuleOptions> {
	const issuer = configService.get<string>('JWT_ISSUER');
	const audience = configService.get<string>('JWT_AUDIENCE');
	const nodeEnv = configService.get<string>('NODE_ENV');

	if (nodeEnv === 'production') {
		if (!issuer) {
			throw new Error('JWT_ISSUER is required in production');
		}
		if (!audience) {
			throw new Error('JWT_AUDIENCE is required in production');
		}
	}

	return {
		privateKey: configService.get<string>('jwtPrivateKey')!,
		publicKey: configService.get<string>('jwtPublicKey')!,
		signOptions: {
			algorithm: 'ES256',
			...(issuer ? { issuer } : {}),
			...(audience ? { audience } : {}),
		},
		verifyOptions: {
			algorithms: ['ES256'],
			...(issuer ? { issuer } : {}),
			...(audience ? { audience } : {}),
		},
	};
}
