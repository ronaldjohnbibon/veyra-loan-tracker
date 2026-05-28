# FIRST CREATE
npm.cmd install @capacitor/android@^7
npm.cmd run build
npx.cmd cap add android
npx.cmd cap sync android
cd android
.\gradlew.bat assembleDebug

# SECOND and so-on
npm run build
npx cap sync android
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd android
.\gradlew.bat assembleDebug

# PROD BUILD
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease

# TEST
npx cap open android

# DEPLOY FIRE STORE RULES
- npm.cmd exec firebase-tools -- deploy --only firestore:rules --project veyra-loan-tracker
or
- npm.cmd exec firebase-tools -- deploy --only firestore:rules

verify if the app can see your projects :
- npm.cmd exec firebase-tools -- projects:list