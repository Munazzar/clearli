#!/bin/bash
# Builds the static web dashboard into web/dist (deploy that folder to GitHub Pages).
set -e
cd "$(dirname "$0")"
rm -rf web/dist && mkdir -p web/dist
cp -r android/assets/www/css android/assets/www/fonts android/assets/www/icon.png web/dist/
mkdir -p web/dist/js && cp android/assets/www/js/*.js web/dist/js/ && rm web/dist/js/appsync.js
cp web/index.html web/web.js web/web.css web/manifest.webmanifest web/dist/
# the web build only needs the Web client ID — keep the phone's Desktop client out of the public site
sed -i -E "s/(appClientId|appClientSecret): '[^']*'/\\1: ''/" web/dist/js/gconfig.js
# the Web client ID can come from the environment (CI: repository variable GOOGLE_WEB_CLIENT_ID)
[ -n "$GOOGLE_WEB_CLIENT_ID" ] && sed -i -E "s/webClientId: '[^']*'/webClientId: '${GOOGLE_WEB_CLIENT_ID}'/" web/dist/js/gconfig.js
touch web/dist/.nojekyll
echo "web/dist ready: $(du -sh web/dist | cut -f1)"
