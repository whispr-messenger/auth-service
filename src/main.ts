import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { webcrypto } from 'crypto';

// Polyfill for crypto.randomUUID in Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

function createSwaggerDocumentation(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Authentication Service')
    .setDescription('API documentation for the Authentication Service')
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.example.com', 'Production')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  createSwaggerDocumentation(app);

  const port = process.env.PORT || 3001;

  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
