import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const config = new pulumi.Config();
const naverId = config.requireSecret('naverId');
const naverPw = config.requireSecret('naverPw');
const openaiApiKey = config.requireSecret('openaiApiKey');
const openaiModel = config.get('openaiModel') || 'gpt-4o-mini';

// IAM Role for Lambda
const lambdaRole = new aws.iam.Role('naver-responder-lambda-role', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'sts:AssumeRole',
        Principal: {
          Service: 'lambda.amazonaws.com',
        },
        Effect: 'Allow',
      },
    ],
  }),
});

// Attach basic Lambda execution policy
new aws.iam.RolePolicyAttachment('lambda-basic-execution', {
  role: lambdaRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
});

// Attach policy for Secrets Manager access
new aws.iam.RolePolicyAttachment('lambda-secrets-access', {
  role: lambdaRole.name,
  policyArn: 'arn:aws:iam::aws:policy/SecretsManagerReadWrite',
});

// Secrets Manager for credentials
const naverCredentials = new aws.secretsmanager.Secret('naver-credentials', {
  name: 'naver-auto-responder/credentials',
  description: 'Naver credentials for auto responder',
});

new aws.secretsmanager.SecretVersion('naver-credentials-version', {
  secretId: naverCredentials.id,
  secretString: pulumi
    .all([naverId, naverPw, openaiApiKey])
    .apply(([id, pw, apiKey]) =>
      JSON.stringify({
        NAVER_ID: id,
        NAVER_PW: pw,
        OPENAI_API_KEY: apiKey,
        OPENAI_MODEL: openaiModel,
      })
    ),
});

// Lambda Layer for Chromium
const chromiumLayer = new aws.lambda.LayerVersion('chromium-layer', {
  layerName: 'chromium',
  code: new pulumi.asset.RemoteArchive(
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-layer.zip'
  ),
  compatibleRuntimes: ['nodejs20.x'],
  description: 'Chromium binary for Puppeteer in Lambda',
});

// Build Lambda deployment package
const buildLambdaPackage = () => {
  // This is a placeholder - actual packaging should be done via build script
  return new pulumi.asset.FileArchive('./dist');
};

// Lambda Function
const lambdaFunction = new aws.lambda.Function('naver-responder-function', {
  name: 'naver-auto-responder',
  runtime: 'nodejs20.x',
  role: lambdaRole.arn,
  handler: 'lambda.handler',
  code: buildLambdaPackage(),
  timeout: 900, // 15 minutes
  memorySize: 2048,
  layers: [chromiumLayer.arn],
  environment: {
    variables: {
      NODE_ENV: 'production',
      SECRET_ARN: naverCredentials.arn,
    },
  },
  ephemeralStorage: {
    size: 2048, // 2GB for Chromium temp files
  },
});

// API Gateway HTTP API
const api = new aws.apigatewayv2.Api('naver-responder-api', {
  name: 'naver-auto-responder-api',
  protocolType: 'HTTP',
  corsConfiguration: {
    allowOrigins: ['*'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['content-type'],
  },
});

// Lambda permission for API Gateway
const lambdaPermission = new aws.lambda.Permission('api-lambda-permission', {
  action: 'lambda:InvokeFunction',
  function: lambdaFunction.name,
  principal: 'apigateway.amazonaws.com',
  sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
});

// API Gateway Integration
const integration = new aws.apigatewayv2.Integration('lambda-integration', {
  apiId: api.id,
  integrationType: 'AWS_PROXY',
  integrationUri: lambdaFunction.arn,
  integrationMethod: 'POST',
  payloadFormatVersion: '2.0',
});

// API Gateway Route (catch-all)
const route = new aws.apigatewayv2.Route('default-route', {
  apiId: api.id,
  routeKey: '$default',
  target: pulumi.interpolate`integrations/${integration.id}`,
});

// API Gateway Stage
const stage = new aws.apigatewayv2.Stage('prod-stage', {
  apiId: api.id,
  name: 'prod',
  autoDeploy: true,
});

// CloudWatch Log Group for Lambda
const logGroup = new aws.cloudwatch.LogGroup('lambda-logs', {
  name: pulumi.interpolate`/aws/lambda/${lambdaFunction.name}`,
  retentionInDays: 14,
});

// Exports
export const apiEndpoint = pulumi.interpolate`${api.apiEndpoint}/${stage.name}`;
export const lambdaFunctionName = lambdaFunction.name;
export const lambdaFunctionArn = lambdaFunction.arn;
export const secretArn = naverCredentials.arn;
