@echo off
title ExiusCart - Setup Daily Backup
color 0A
echo.
echo ============================================
echo   ExiusCart - Setup Automatic Daily Backup
echo ============================================
echo.
echo This will set up an automatic backup every day at 2:00 AM.
echo Backups go to: C:\ExiusCart\backups\
echo Also copies to Google Drive if installed.
echo.

:: Copy backup script to permanent location
if not exist "C:\ExiusCart\backup" mkdir "C:\ExiusCart\backup"
copy /Y "%~dp0exiuscart_backup.bat" "C:\ExiusCart\backup\exiuscart_backup.bat" >nul

:: Create Windows Scheduled Task - runs daily at 2:00 AM
schtasks /delete /tn "ExiusCart Daily Backup" /f 2>nul
schtasks /create ^
    /tn "ExiusCart Daily Backup" ^
    /tr "C:\ExiusCart\backup\exiuscart_backup.bat" ^
    /sc daily ^
    /st 02:00 ^
    /ru SYSTEM ^
    /rl highest ^
    /f

if %ERRORLEVEL% == 0 (
    echo.
    echo [SUCCESS] Daily backup scheduled!
    echo   Runs every day at 2:00 AM automatically.
    echo   Backups saved to: C:\ExiusCart\backups\
    echo   Last 7 days are kept, older ones deleted automatically.
    echo.
    echo [*] Running first backup now...
    call "C:\ExiusCart\backup\exiuscart_backup.bat"
) else (
    echo [ERROR] Failed to create scheduled task. Try running as Administrator.
)

echo.
pause
