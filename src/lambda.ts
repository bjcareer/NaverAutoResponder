import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication } from '@nestjs/common';
import serverlessExpress from '@codegenie/serverless-express';
import { Handler } from 'aws-lambda';
import express from 'express';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AppModule } from './app.module';

let cachedServer: Handler;

async function loadSecretsToEnv(): Promise<void> {
  const secretArn = process.env.SECRET_ARN;
  if (!secretArn) {
    console.warn('SECRET_ARN not found, skipping Secrets Manager load');
    return;
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });

  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      Object.assign(process.env, secrets);
      console.log('Secrets loaded successfully from Secrets Manager');
    }
  } catch (error) {
    console.error('Failed to load secrets from Secrets Manager:', error);
    throw error;
  }
}

async function bootstrap(): Promise<INestApplication> {
  // Load secrets into environment variables
  await loadSecretsToEnv();

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable CORS for API Gateway
  app.enableCors();

  await app.init();
  return app;
}

export const handler: Handler = async (event, context, callback) => {
  if (!cachedServer) {
    const app = await bootstrap();
    const expressApp = app.getHttpAdapter().getInstance();
    cachedServer = serverlessExpress({ app: expressApp });
  }

  return cachedServer(event, context, callback);
};
