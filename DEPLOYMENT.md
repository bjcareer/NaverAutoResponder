# AWS Lambda Deployment Guide

## Prerequisites

1. **AWS CLI 설치 및 구성**
```bash
aws configure
# AWS Access Key ID, Secret Access Key, Region (ap-northeast-2) 입력
```

2. **Pulumi CLI 설치**
```bash
# macOS
brew install pulumi

# 다른 OS는 https://www.pulumi.com/docs/get-started/install/ 참조
```

3. **Pulumi 로그인**
```bash
pulumi login
```

## Deployment Steps

### 1. Pulumi 프로젝트 초기화
```bash
pulumi stack init dev  # dev 스택 생성
```

### 2. 시크릿 설정
```bash
# Naver 계정 정보
pulumi config set --secret naverId "your-naver-id"
pulumi config set --secret naverPw "your-naver-password"

# OpenAI API Key
pulumi config set --secret openaiApiKey "your-openai-api-key"

# OpenAI Model (optional, default: gpt-5-mini)
pulumi config set openaiModel "gpt-5-mini"
```

### 3. Lambda 패키지 빌드
```bash
npm run build:lambda
```

빌드가 완료되면 `dist/` 디렉토리에 Lambda 배포 패키지가 생성됩니다.

### 4. 인프라 배포
```bash
pulumi up
```

배포 계획을 확인하고 `yes`를 입력하여 진행합니다.

### 5. 배포 결과 확인
```bash
pulumi stack output
```

다음 정보들이 출력됩니다:
- `apiEndpoint`: API Gateway 엔드포인트 URL
- `lambdaFunctionName`: Lambda 함수 이름
- `lambdaFunctionArn`: Lambda 함수 ARN
- `secretArn`: Secrets Manager ARN

## API 사용 방법

### 질문 자동 응답 처리
```bash
POST {apiEndpoint}/question-processor

Content-Type: application/json

{
  "keyword": "검색할 질문 키워드",
  "promotionLink": "https://your-promotion-link.com" (optional)
}
```

Example:
```bash
curl -X POST https://your-api-endpoint.execute-api.ap-northeast-2.amazonaws.com/prod/question-processor \
  -H "Content-Type: application/json" \
  -d '{"keyword": "주식 투자", "promotionLink": "https://next-stock.com"}'
```

Response:
```json
{
  "processed": 5,
  "errors": 0
}
```

## 인프라 구성

### Lambda Function
- **Runtime**: Node.js 20.x
- **Memory**: 2048 MB
- **Timeout**: 15 minutes (900 seconds)
- **Ephemeral Storage**: 2048 MB (Chromium 임시 파일용)
- **Layers**: Chromium Layer (Puppeteer용)

### API Gateway
- **Type**: HTTP API
- **CORS**: Enabled for all origins
- **Integration**: Lambda Proxy

### Secrets Manager
- **Secret Name**: `naver-auto-responder/credentials`
- **Contents**: NAVER_ID, NAVER_PW, OPENAI_API_KEY, OPENAI_MODEL

### IAM Role
- **Policies**:
  - AWSLambdaBasicExecutionRole (CloudWatch Logs)
  - SecretsManagerReadWrite (Secrets Manager 접근)

### CloudWatch Logs
- **Log Group**: `/aws/lambda/naver-auto-responder`
- **Retention**: 14 days

## Monitoring

### CloudWatch Logs
```bash
aws logs tail /aws/lambda/naver-auto-responder --follow
```

### Lambda Metrics
Lambda 콘솔에서 다음 메트릭 확인:
- Invocations: 호출 횟수
- Duration: 실행 시간
- Errors: 에러 발생 횟수
- Throttles: 스로틀링 발생 횟수

## Cost Estimation

### Lambda
- **Free Tier**: 월 100만 요청, 40만 GB-초
- **Pricing**: $0.0000166667 per GB-second
- **Example**: 2GB 메모리 × 180초 × 100회 = 약 $0.60

### API Gateway
- **Free Tier**: 월 100만 요청
- **Pricing**: $1.00 per million requests

### Secrets Manager
- **Pricing**: $0.40 per secret per month + $0.05 per 10,000 API calls

## Troubleshooting

### Lambda Cold Start 느림
- **원인**: Chromium 초기화 시간
- **해결**: Provisioned Concurrency 설정 (추가 비용 발생)

### Timeout 에러
- **원인**: 질문 처리 시간 초과
- **해결**:
  1. 질문 수 제한
  2. Timeout 시간 증가 (최대 15분)

### Memory 부족 에러
- **원인**: Chromium 메모리 사용량
- **해결**: Lambda 메모리 증가 (현재 2048MB)

### Secrets Manager 접근 에러
- **원인**: IAM 권한 부족
- **해결**: Lambda Role에 SecretsManagerReadWrite 정책 확인

## Cleanup

### 스택 삭제 (모든 리소스 제거)
```bash
pulumi destroy
```

### 스택 제거
```bash
pulumi stack rm dev
```

## Local Development

로컬에서는 `.env` 파일을 사용하고, Lambda에서는 Secrets Manager를 사용합니다.

로컬 테스트:
```bash
npm run start:dev
```

Lambda 핸들러 로컬 테스트는 AWS SAM 또는 serverless-offline 사용을 권장합니다.

## CI/CD Integration

GitHub Actions, GitLab CI, AWS CodePipeline 등과 통합 가능:

```yaml
# .github/workflows/deploy.yml 예시
name: Deploy to Lambda
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build:lambda
      - uses: pulumi/actions@v4
        with:
          command: up
          stack-name: production
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

## Security Best Practices

1. **Secrets 관리**: Secrets Manager 사용 (환경변수 노출 금지)
2. **IAM 최소 권한**: Lambda Role에 필요한 권한만 부여
3. **VPC 배치** (optional): 민감한 데이터 처리 시 Private Subnet 사용
4. **API 인증**: API Gateway에 인증 추가 (API Key, Cognito, Lambda Authorizer)
5. **Rate Limiting**: API Gateway Throttling 설정

## References

- [Pulumi AWS Documentation](https://www.pulumi.com/docs/clouds/aws/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Puppeteer on Lambda](https://github.com/Sparticuz/chromium)
