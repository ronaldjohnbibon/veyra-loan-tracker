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

# TEST
npx cap open android