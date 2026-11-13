import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { DEMO_USER_HEADER } from './modules/user/demo-user.guard.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks(); // run onModuleDestroy (closes DB pool) on Ctrl+C / restarts
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TechCart API')
    .setDescription('Stripe integration learning project')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: DEMO_USER_HEADER, description: 'e.g. demo-sarah' },
      'demo-user',
    )
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, swaggerConfig),
    { swaggerOptions: { persistAuthorization: true } },
  );

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
