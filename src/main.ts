import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // whitelist:true -> field yang tidak ada di DTO otomatis dibuang (padanan
  // "hanya field yang di-validate() yang lewat" di FormRequest Laravel,
  // mis. shop_id yang sengaja tidak ada di RegisterDto/UpdateProfileDto).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Server jalan di http://localhost:${port}/api`);
}

bootstrap();
