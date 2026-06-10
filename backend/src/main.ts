require('dotenv').config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './home/app.module';
import { HttpExceptionFilter, configManager } from '@common/config';
import { ConfigKey } from '@common/config/enum';
import { swaggerConfiguration } from '@common/documentation';
import { Logger, ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiInterceptor, ValidationException } from '@common/api';
import { json } from 'express';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);

  // Limite augmentée pour le webhook du site vitrine : pièces jointes en base64 (max ~20Mo de fichiers)
  app.use(json({ limit: '30mb' }));
  
  // Configuration CORS pour autoriser les requêtes depuis le frontend Render
  app.enableCors({
    origin: [
      'https://gravisterie-app-frontend.onrender.com',
      'https://admin.gravisterie.be',
      'http://localhost:4200', // Pour le développement local
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  app.setGlobalPrefix(configManager.getValue(ConfigKey.APP_BASE_URL));
  app.useGlobalFilters(new HttpExceptionFilter());
  swaggerConfiguration.config(app);
  app.useGlobalPipes(new ValidationPipe({
    exceptionFactory: (validationErrors: ValidationError[] = []) => new ValidationException(validationErrors)
  }));
  app.useGlobalInterceptors(new ApiInterceptor());
  await app.listen(parseInt(configManager.getValue(ConfigKey.APP_PORT), 10));
  
};

bootstrap().then(()=>{
  const logger = new Logger('Main Logger');
  logger.log('Server is started !!')
  });
 