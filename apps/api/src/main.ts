import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks(); // run onModuleDestroy (closes DB pool) on Ctrl+C / restarts
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
