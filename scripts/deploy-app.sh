#!/bin/bash
# Deploy the app to grants.apcosoftwaretools.ca. Copies app/ into deploy/dist with the production API base, drops the
# test files, and deploys deploy/app/wrangler.toml. The API Worker deploys separately: `cd worker && npx wrangler deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API_BASE:-https://grant-match-nl.alexjpower74.workers.dev}"
rm -rf deploy/dist; mkdir -p deploy/dist
cp -r app/. deploy/dist/
rm -rf deploy/dist/tests deploy/dist/playwright.config.mjs deploy/dist/serve.mjs
sed -i "s#content=\"http://127.0.0.1:7402\"#content=\"$API\"#" deploy/dist/*.html
if grep -l "127.0.0.1:7402" deploy/dist/*.html; then echo "a page still points at the local API"; exit 1; fi
(cd deploy/app && npx wrangler deploy)
echo "deployed: https://grants.apcosoftwaretools.ca"
