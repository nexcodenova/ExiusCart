@echo off
title ExiusCart - Step 3: Install Frontend
color 0A
echo.
echo ============================================
echo   ExiusCart Setup - Step 3: Frontend
echo ============================================
echo.

if not exist "C:\ExiusCart\frontend" mkdir "C:\ExiusCart\frontend"

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] Node.js not found. Downloading Node.js 20...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '%TEMP%\node_installer.msi' -UseBasicParsing"
    msiexec /i "%TEMP%\node_installer.msi" /quiet /norestart
    :: Refresh PATH
    set PATH=%PATH%;C:\Program Files\nodejs
)

echo [*] Copying frontend files...
xcopy /E /I /Y "%~dp0frontend" "C:\ExiusCart\frontend" >nul

cd /d "C:\ExiusCart\frontend"

echo [*] Installing Node.js dependencies (this takes 2-3 minutes)...
call npm install --quiet

echo [*] Building the frontend for production...
:: Set API URL to local backend
set NEXT_PUBLIC_API_URL=http://localhost:8000
call npm run build

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)

echo.
echo [*] Installing frontend as Windows Service...

:: Remove old service if exists
"C:\ExiusCart\nssm.exe" stop ExiusCartFrontend 2>nul
"C:\ExiusCart\nssm.exe" remove ExiusCartFrontend confirm 2>nul

:: Install new service
"C:\ExiusCart\nssm.exe" install ExiusCartFrontend node
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend AppDirectory "C:\ExiusCart\frontend"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend AppParameters "node_modules\.bin\next start -p 3001"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend AppEnvironmentExtra "NEXT_PUBLIC_API_URL=http://localhost:8000" "PORT=3001"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend DisplayName "ExiusCart Shop Dashboard"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend Description "ExiusCart Next.js shop dashboard"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend Start SERVICE_AUTO_START
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend AppStdout "C:\ExiusCart\logs\frontend.log"
"C:\ExiusCart\nssm.exe" set ExiusCartFrontend AppStderr "C:\ExiusCart\logs\frontend-error.log"

:: Start the service
"C:\ExiusCart\nssm.exe" start ExiusCartFrontend

echo.
echo [*] Waiting for frontend to start...
timeout /t 8 /nobreak >nul

powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing; Write-Host '[SUCCESS] Frontend is running!' } catch { Write-Host '[WARNING] Frontend may still be starting...' }"

echo.
echo [SUCCESS] Frontend installed as Windows Service!
echo   Dashboard runs at: http://localhost:3001
echo   Auto-starts on Windows boot.
echo.
pause
