import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export async function jwtModuleOptionsFactory(configService: ConfigService): Promise<JwtModuleOptions> {
	return {
		privateKey: configService.get<string>('jwtPrivateKey')!,
		publicKey: configService.get<string>('jwtPublicKey')!,
		signOptions: {
			algorithm: 'ES256',
		},
		verifyOptions: {
			algorithms: ['ES256'],
		},
	};
}
