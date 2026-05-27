@echo off
title ExiusCart - Full Setup
color 0A
echo.
echo =====================================================
echo   ExiusCart - Full Local Installation
echo   This PC will become the shop's data server.
echo =====================================================
echo.
echo This will install:
echo   1. PostgreSQL  (database)
echo   2. Backend API (FastAPI - auto-starts on boot)
echo   3. Frontend    (shop dashboard - auto-starts on boot)
echo   4. Daily Backup (2:00 AM to Google Drive)
echo.
echo IMPORTANT: Run this as Administrator!
echo.
pause

:: Step 1 - PostgreSQL
call "%~dp01_install_postgresql.bat"
if %ERRORLEVEL% neq 0 goto :error

:: Step 2 - Backend
call "%~dp02_install_backend.bat"
if %ERRORLEVEL% neq 0 goto :error

:: Step 3 - Frontend
call "%~dp03_install_frontend.bat"
if %ERRORLEVEL% neq 0 goto :error

:: Step 4 - Backup
call "%~dp0backup\setup_backup.bat"

echo.
echo =====================================================
echo   INSTALLATION COMPLETE!
echo =====================================================
echo.
echo   Login at: admin@exiuscart.com
echo   Password: Admin@123
echo   (Change the password after first login!)
echo.
echo   Everything starts automatically when Windows boots.
echo.
goto :done

:error
echo.
echo [ERROR] Installation failed at one of the steps.
echo Please check the error above and try again.
echo Or contact ExiusCart support.
echo.

:done
pause
