import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export async function jwtModuleOptionsFactory(configService: ConfigService): Promise<JwtModuleOptions> {
	return {
		privateKey: configService.get<string>('jwtPrivateKey')!,
		publicKey: configService.get<string>('jwtPublicKey')!,
		signOptions: {
			algorithm: 'ES256',
			issuer: configService.getOrThrow<string>('JWT_ISSUER'),
			audience: configService.getOrThrow<string>('JWT_AUDIENCE'),
		},
		verifyOptions: {
			algorithms: ['ES256'],
		},
	};
}
