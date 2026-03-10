import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import { JwtKeysConfig } from '../../../config/jwt-keys.config';

export async function jwtModuleOptionsFactory(
	configService: ConfigService<JwtKeysConfig>
): Promise<JwtModuleOptions> {
	return {
		privateKey: configService.get('jwtPrivateKey'),
		publicKey: configService.get('jwtPublicKey'),
		signOptions: {
			algorithm: 'ES256',
			expiresIn: '1h',
		},
		verifyOptions: {
			algorithms: ['ES256'],
		},
	};
}
