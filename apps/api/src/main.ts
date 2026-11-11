import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks(); // run onModuleDestroy (closes DB pool) on Ctrl+C / restarts

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TechCart API')
    .setDescription('Stripe integration learning project')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
