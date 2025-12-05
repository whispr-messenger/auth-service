import { NestFactory } from '@nestjs/core';
import { Logger, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { createSwaggerDocumentation } from './factories/swagger';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const configService = app.get(ConfigService);
	const logger = new Logger('Bootstrap');
	const port = configService.get<number>('HTTP_PORT', 3001);

	app.setGlobalPrefix('auth');

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
		prefix: 'v',
	});

	createSwaggerDocumentation(app, port, configService);

	await app.listen(port);

	logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();
