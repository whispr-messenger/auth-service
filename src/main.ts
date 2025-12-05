import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

function createSwaggerDocumentation(app: NestExpressApplication, port: number) {
	const config = new DocumentBuilder()
		.setTitle('Authentication Service')
		.setDescription('API documentation for the Authentication Service')
		.setVersion('1.0')
		.addServer(`http://localhost:${port}`, 'Development')
		.addServer('https://api.example.com', 'Production')
		.build();

	const documentFactory = () => SwaggerModule.createDocument(app, config);

	// https://docs.nestjs.com/openapi/introduction#document-options
	SwaggerModule.setup('api', app, documentFactory);
}

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const configService = app.get(ConfigService);
	const port = configService.get<number>('HTTP_PORT', 3001);

	createSwaggerDocumentation(app, port);

	await app.listen(port);

	console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
