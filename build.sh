#!/bin/bash
set -e
cd "$(dirname "$0")/android"
SDK=/usr/lib/android-sdk
AJAR=$SDK/platforms/android-23/android.jar
OUT=../build; rm -rf $OUT; mkdir -p $OUT/gen $OUT/classes
aapt package -f -m -J $OUT/gen -M AndroidManifest.xml -S res -A assets -I $AJAR -F $OUT/app.unsigned.apk -0 woff2
javac -Xlint:-options --release 8 -encoding UTF-8 -cp $AJAR -d $OUT/classes $(find src $OUT/gen -name "*.java") 2>&1 | grep -v JAVA_TOOL_OPTIONS || true
[ -f $OUT/classes/com/clearli/app/MainActivity.class ] && [ -f $OUT/classes/com/clearli/app/CalWidget.class ] || { echo "javac failed"; exit 1; }
dalvik-exchange --dex --min-sdk-version=23 --output=$OUT/classes.dex $OUT/classes
( cd $OUT && zip -q app.unsigned.apk classes.dex )
zipalign -f -p 4 $OUT/app.unsigned.apk $OUT/app.aligned.apk
KS=../release.keystore
[ -f $KS ] || keytool -genkeypair -keystore $KS -storepass clearli123 -keypass clearli123 -alias clearli -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Clearli, O=Clearli" >/dev/null 2>&1
apksigner sign --ks $KS --ks-pass pass:clearli123 --ks-key-alias clearli --min-sdk-version 23 --out $OUT/Clearli.apk $OUT/app.aligned.apk
apksigner verify --print-certs $OUT/Clearli.apk | head -2
ls -la $OUT/Clearli.apk
