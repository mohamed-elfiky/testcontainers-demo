import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const httpPort = configService.get<number>('PORT', 3000);

  await app.listen(httpPort);
  logger.log(`HTTP server running on port ${httpPort}`);
}
void bootstrap();
