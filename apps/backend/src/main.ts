import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { port, swaggerEnabled, nodeEnv, corsOrigins } =
    config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableShutdownHooks();

  // Standard security headers. The CSP is dropped where Swagger runs, because
  // its UI is inline script and would be blocked by the default policy; in
  // production Swagger is off and the full policy applies.
  app.use(helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }));

  /*
   * Cross-origin access is opt-in through CORS_ORIGINS.
   *
   * The standard deploy puts nginx in front of both the web app and the API on
   * one origin, so nothing cross-site happens and no header is needed. A
   * frontend on its own domain — a Vercel preview, later the mobile web build —
   * has to be named explicitly. Reflecting whatever Origin arrives would be the
   * easy version and would hand any site on the internet an authenticated
   * channel to this API.
   */
  if (corsOrigins.length) {
    app.enableCors({ origin: corsOrigins, credentials: true, maxAge: 86_400 });
    logger.log(`CORS enabled for: ${corsOrigins.join(', ')}`);
  } else if (nodeEnv !== 'production') {
    app.enableCors({ origin: true, credentials: true });
  }

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
