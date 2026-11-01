@echo off
setlocal
cd /d "%~dp0"
title Sajel - build Android APK

echo ============================================
echo   Sajel - building the Android APK
echo ============================================
echo Tip: keep this folder at a SHORT path like C:\sajel (Windows path-length limits break Android builds).
echo.

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
rem English Gradle messages (Arabic digits used to come out garbled in this window).
set "GRADLE_OPTS=-Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 22 LTS from https://nodejs.org and run this again.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [1/6] Installing pnpm...
  call npm install -g pnpm@9.12.0
  if errorlevel 1 (
    echo [ERROR] Could not install pnpm. Try running this file as Administrator.
    pause
    exit /b 1
  )
) else (
  echo [1/6] pnpm found.
)

echo.
echo [2/6] Looking for Java 21...
set "JDK="
if exist "%LOCALAPPDATA%\Sajel\jdk21\bin\java.exe" set "JDK=%LOCALAPPDATA%\Sajel\jdk21"
if not defined JDK goto :getjdk
goto :havejdk

:getjdk
echo Java 21 not found. Downloading a private copy (about 190 MB, one time only)...
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $d=Join-Path $env:LOCALAPPDATA 'Sajel'; New-Item -ItemType Directory -Force $d | Out-Null; $z=Join-Path $d 'jdk21.zip'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $z; $t=Join-Path $d 'jdk-tmp'; if (Test-Path $t) { Remove-Item -Recurse -Force $t }; Expand-Archive -Force $z $t; $inner=(Get-ChildItem $t -Directory | Select-Object -First 1).FullName; $j=Join-Path $d 'jdk21'; if (Test-Path $j) { Remove-Item -Recurse -Force $j }; Move-Item $inner $j; Remove-Item -Recurse -Force $t; Remove-Item $z"
if errorlevel 1 (
  echo [ERROR] Could not download Java 21. Check your internet connection and try again.
  pause
  exit /b 1
)
set "JDK=%LOCALAPPDATA%\Sajel\jdk21"

:havejdk
set "JAVA_HOME=%JDK%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using Java at %JAVA_HOME%

echo.
echo [3/6] Looking for the Android SDK...
set "SDK="
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platforms" set "SDK=%ANDROID_HOME%"
if not defined SDK if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platforms" set "SDK=%ANDROID_SDK_ROOT%"
if not defined SDK if exist "%LOCALAPPDATA%\Android\Sdk\platforms" set "SDK=%LOCALAPPDATA%\Android\Sdk"
if not defined SDK (
  echo [ERROR] Android SDK not found. Install Android Studio once ^(it installs the SDK^), then run this again.
  pause
  exit /b 1
)
set "ANDROID_HOME=%SDK%"
set "ANDROID_SDK_ROOT=%SDK%"
echo Using SDK at %SDK%
rem Accept the standard SDK license so Gradle can download any missing platform/build-tools by itself.
if not exist "%SDK%\licenses" mkdir "%SDK%\licenses"
>> "%SDK%\licenses\android-sdk-license" echo.
>> "%SDK%\licenses\android-sdk-license" echo 24333f8a63b6825ea9c5514f83c2829b004d1fee
>> "%SDK%\licenses\android-sdk-license" echo 8933bad161af4178b1185d1a37fbf41ea5269c55
>> "%SDK%\licenses\android-sdk-license" echo d56f5187479451eabf01fb78af6dfcb131a6481e
>> "%SDK%\licenses\android-sdk-license" echo 84831b9409646a918e30573bab4c9c91346d8abd
>> "%SDK%\licenses\android-sdk-preview-license" echo.
>> "%SDK%\licenses\android-sdk-preview-license" echo 84831b9409646a918e30573bab4c9c91346d8abd
rem Also accept every license through sdkmanager when it is available.
set "SDKM="
if exist "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" set "SDKM=%SDK%\cmdline-tools\latest\bin\sdkmanager.bat"
if defined SDKM (
  echo Accepting Android SDK licenses...
  (for /l %%i in (1,1,40) do @echo y) | call "%SDKM%" --licenses >nul 2>nul
)

echo.
echo [4/6] Installing app dependencies (first time takes a few minutes)...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo First attempt failed, retrying without the frozen lockfile...
  call pnpm install --no-frozen-lockfile
  if errorlevel 1 (
    echo [ERROR] Dependency install failed. Check your internet and try again.
    pause
    exit /b 1
  )
)

echo.
echo [5/6] Preparing the native Android project...
rem Regenerate the android folder from scratch whenever the app config or native plugin changed,
rem so an old android folder from a previous version can never be reused by mistake.
set "STAMP="
for /f "usebackq delims=" %%h in (`%PS% -NoProfile -Command "(Get-FileHash -Algorithm MD5 -LiteralPath 'package.json','app.config.ts','plugins\with-sajel-recorder.js').Hash -join ''"`) do set "STAMP=%%h"
set "OLDSTAMP="
if exist "android\.sajel-stamp" set /p OLDSTAMP=<"android\.sajel-stamp"
set "CLEAN="
if not "%STAMP%"=="%OLDSTAMP%" set "CLEAN=--clean"
if defined CLEAN echo The project setup changed, regenerating the android folder...
if exist android if defined CLEAN (
  pushd android
  call .\gradlew.bat --stop >nul 2>nul
  popd
)
set "CI=1"
call pnpm exec expo prebuild --platform android --no-install %CLEAN%
if errorlevel 1 (
  echo [ERROR] expo prebuild failed. See the messages above.
  pause
  exit /b 1
)
> "android\.sajel-stamp" echo %STAMP%

echo.
echo [6/6] Building the APK. The first build can take 10-25 minutes; later builds are much faster.
echo       A full log is written to build-android-log.txt in this folder.
cd android
rem Stop old Gradle/Kotlin daemons and drop half-written caches from a previous failed run.
call .\gradlew.bat --stop >nul 2>nul
if exist .gradle rmdir /s /q .gradle
rem Long timeouts and automatic retries: the React Native library is a single ~280 MB download.
set "GARGS=-PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process -Dorg.gradle.jvmargs=-Xmx4096m -Dorg.gradle.internal.http.connectionTimeout=180000 -Dorg.gradle.internal.http.socketTimeout=180000 -Dorg.gradle.internal.repository.max.retries=8 -Dorg.gradle.internal.repository.initial.backoff=2000"
set "TRY=1"

:gradle
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "cmd /c '.\gradlew.bat :app:assembleRelease %GARGS% --console=plain 2>&1' | Tee-Object -FilePath '..\build-android-log.txt'; exit $LASTEXITCODE"
if not errorlevel 1 goto :built
if "%TRY%"=="1" (
  set "TRY=2"
  echo.
  echo The build failed once. Network problems are often temporary - trying again automatically...
  echo ^(Everything already downloaded is kept, so this is faster.^)
  echo.
  goto :gradle
)
echo.
echo ============================================
echo [ERROR] The Android build failed. The important part:
echo ============================================
"%PS%" -NoProfile -Command "$t = Get-Content -LiteralPath '..\build-android-log.txt'; $hits = $t | Select-String -Pattern 'What went wrong' -Context 0,12; if ($hits) { $hits | Select-Object -First 3 | ForEach-Object { $_.Context.PostContext } } else { $t | Select-Object -Last 40 }"
echo.
echo Send the file build-android-log.txt ^(in this folder^) to Claude.
cd ..
pause
exit /b 1

:built
cd ..

set "APK=android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK%" (
  echo [ERROR] The build finished but the APK was not found at %APK%
  pause
  exit /b 1
)
copy /Y "%APK%" "Sajel.apk" >nul
echo.
echo ============================================
echo   Done: Sajel.apk  (in this folder)
echo   Send it to your phone/tablet and install it.
echo ============================================
if not defined SAJEL_NO_EXPLORER explorer /select,"%CD%\Sajel.apk"
pause
endlocal
