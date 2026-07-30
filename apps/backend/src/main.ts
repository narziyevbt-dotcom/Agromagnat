import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { port, swaggerEnabled, nodeEnv } = config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Agromagnat API')
        .setDescription("O'zbekiston agro bozori — backend API")
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Agromagnat backend listening on :${port} (${nodeEnv})`);
  if (swaggerEnabled) {
    logger.log(`Swagger available at :${port}/docs`);
  }
}

void bootstrap();
