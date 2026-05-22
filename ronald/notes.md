# FIRST CREATE
npm.cmd install @capacitor/android@^7
npm.cmd run build
npx.cmd cap add android
npx.cmd cap sync android
cd android
.\gradlew.bat assembleDebug