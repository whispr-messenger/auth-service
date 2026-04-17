import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export async function jwtModuleOptionsFactory(configService: ConfigService): Promise<JwtModuleOptions> {
	const issuer = configService.get<string>('JWT_ISSUER');
	const audience = configService.get<string>('JWT_AUDIENCE');

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
