#!/bin/bash
set -e

echo "🏗️  Building Lambda deployment package..."

# Clean previous build
rm -rf dist
rm -f lambda-package.zip

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npx tsc

# Copy package.json and install production dependencies
echo "📦 Installing production dependencies..."
cp package.json dist/
cp package-lock.json dist/
cd dist
npm ci --omit=dev --ignore-scripts

# Remove unnecessary files to reduce package size
echo "🧹 Cleaning up unnecessary files..."
rm -rf node_modules/aws-sdk  # AWS SDK is provided by Lambda runtime
rm -rf node_modules/@types
rm -rf node_modules/**/*.md
rm -rf node_modules/**/test
rm -rf node_modules/**/tests
rm -rf node_modules/**/*.ts
find node_modules -name "*.d.ts" -type f -delete

# Puppeteer cleanup (using puppeteer-core, so remove bundled chromium if any)
rm -rf node_modules/puppeteer/.local-chromium 2>/dev/null || true

echo "✅ Lambda build complete!"
echo "📊 Package size:"
du -sh .

cd ..
echo "📦 Deployment files are in ./dist directory"
