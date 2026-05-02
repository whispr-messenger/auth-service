import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './modules/app/app.module';
import { createSwaggerDocumentation } from './swagger';
import { LoggingInterceptor } from './interceptors';
import { getLogLevels } from './config/log-level';
import { JsonLogger } from './utils/json-logger';

async function bootstrap() {
	// WHISPR-1068 : logger JSON quand LOG_FORMAT=json pour Loki/ELK ;
	// sinon on retombe sur le logger natif avec le filtre LOG_LEVEL.
	const useJsonLogger = (process.env.LOG_FORMAT ?? '').toLowerCase() === 'json';
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: useJsonLogger
			? new JsonLogger({ service: 'auth-service' })
			: getLogLevels(process.env.LOG_LEVEL),
	});
	app.set('trust proxy', 1);
	const configService = app.get(ConfigService);
	const logger = new Logger('Bootstrap');
	const port = configService.get<number>('HTTP_PORT', 3001);
	const globalPrefix = 'auth';

	app.setGlobalPrefix(globalPrefix);

	const corsOrigins = configService
		.get<string>('CORS_ORIGINS', '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	if (corsOrigins.length > 0) {
		app.enableCors({
			origin: corsOrigins,
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Authorization',
				'Content-Type',
				'Accept',
				'Origin',
				'X-Requested-With',
				'X-Device-Type',
			],
			credentials: true,
		});
		logger.log(`CORS enabled for origins: ${corsOrigins.join(', ')}`);
	}

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
		prefix: 'v',
	});

	createSwaggerDocumentation(app, port, configService, globalPrefix);

	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	app.useGlobalInterceptors(new LoggingInterceptor());

	app.enableShutdownHooks();

	await app.listen(port);

	logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();
