@echo off
title ExiusCart - Step 1: Install PostgreSQL
color 0A
echo.
echo ============================================
echo   ExiusCart Setup - Step 1: PostgreSQL
echo ============================================
echo.

:: Check if PostgreSQL already installed
where psql >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] PostgreSQL is already installed. Skipping.
    goto :configure
)

echo [*] Downloading PostgreSQL 16 installer...
powershell -Command "Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe' -OutFile '%TEMP%\pg_installer.exe' -UseBasicParsing"

if not exist "%TEMP%\pg_installer.exe" (
    echo [ERROR] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo [*] Installing PostgreSQL silently (this takes 2-3 minutes)...
"%TEMP%\pg_installer.exe" ^
    --mode unattended ^
    --unattendedmodeui none ^
    --superpassword "ExiusCart@2024" ^
    --servicename "postgresql-x64-16" ^
    --servicepassword "ExiusCart@2024" ^
    --serverport 5432 ^
    --prefix "C:\PostgreSQL\16" ^
    --datadir "C:\ExiusCart\database"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] PostgreSQL installation failed.
    pause
    exit /b 1
)

:configure
echo.
echo [*] Setting up ExiusCart database...

:: Add psql to PATH for this session
set PATH=%PATH%;C:\PostgreSQL\16\bin

:: Create database and user
psql -U postgres -c "CREATE USER exiuscart WITH PASSWORD 'ExiusCart@2024';" 2>nul
psql -U postgres -c "CREATE DATABASE exiuscart_db OWNER exiuscart;" 2>nul
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE exiuscart_db TO exiuscart;" 2>nul

echo.
echo [SUCCESS] PostgreSQL installed and database created!
echo   Database: exiuscart_db
echo   User:     exiuscart
echo   Password: ExiusCart@2024
echo   Port:     5432
echo.
pause
