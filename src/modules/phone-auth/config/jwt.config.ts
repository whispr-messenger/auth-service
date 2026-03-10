import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export async function jwtModuleOptionsFactory(configService: ConfigService): Promise<JwtModuleOptions> {
	const privateKeyFile = configService.get<string>('JWT_PRIVATE_KEY_FILE')!;
	const publicKeyFile = configService.get<string>('JWT_PUBLIC_KEY_FILE')!;

	return {
		privateKey: fs.readFileSync(privateKeyFile, 'utf8').trim(),
		publicKey: fs.readFileSync(publicKeyFile, 'utf8').trim(),
		signOptions: {
			algorithm: 'ES256',
			expiresIn: '1h',
		},
		verifyOptions: {
			algorithms: ['ES256'],
		},
	};
}
