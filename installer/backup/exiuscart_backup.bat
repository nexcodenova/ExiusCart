@echo off
::
:: ExiusCart Daily Backup Script
:: Runs automatically via Windows Task Scheduler (set up by setup_backup.bat)
:: Backs up: PostgreSQL database + uploaded product images
:: Destination: C:\ExiusCart\backups\  AND  Google Drive folder (if installed)
::

set BACKUP_DATE=%date:~10,4%-%date:~4,2%-%date:~7,2%
set BACKUP_TIME=%time:~0,2%-%time:~3,2%
set BACKUP_NAME=exiuscart_backup_%BACKUP_DATE%
set BACKUP_DIR=C:\ExiusCart\backups\%BACKUP_NAME%
set PG_PATH=C:\PostgreSQL\16\bin
set LOG_FILE=C:\ExiusCart\logs\backup.log

:: Create backup folder
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [%BACKUP_DATE% %BACKUP_TIME%] Starting backup... >> "%LOG_FILE%"

:: ── 1. Backup PostgreSQL database ─────────────────────────────────────────
echo [*] Backing up database...
set PGPASSWORD=ExiusCart@2024
"%PG_PATH%\pg_dump.exe" -U exiuscart -h localhost -p 5432 exiuscart_db -F c -f "%BACKUP_DIR%\database.backup"

if %ERRORLEVEL% == 0 (
    echo [%BACKUP_DATE%] Database backup OK >> "%LOG_FILE%"
) else (
    echo [%BACKUP_DATE%] ERROR: Database backup failed >> "%LOG_FILE%"
)

:: ── 2. Backup uploaded product images ─────────────────────────────────────
echo [*] Backing up uploaded images...
if exist "C:\ExiusCart\uploads" (
    xcopy /E /I /Y /Q "C:\ExiusCart\uploads" "%BACKUP_DIR%\uploads" >nul
    echo [%BACKUP_DATE%] Images backup OK >> "%LOG_FILE%"
)

:: ── 3. Copy to Google Drive (if Google Drive for Desktop is installed) ─────
set GDRIVE_PATH=%USERPROFILE%\Google Drive\ExiusCart Backups
if exist "%USERPROFILE%\Google Drive" (
    if not exist "%GDRIVE_PATH%" mkdir "%GDRIVE_PATH%"
    xcopy /E /I /Y /Q "%BACKUP_DIR%" "%GDRIVE_PATH%\%BACKUP_NAME%" >nul
    echo [%BACKUP_DATE%] Google Drive sync OK >> "%LOG_FILE%"
) else (
    echo [%BACKUP_DATE%] Google Drive not found, skipping cloud backup >> "%LOG_FILE%"
)

:: Also check new Google Drive path (newer versions)
set GDRIVE_PATH2=%USERPROFILE%\My Drive\ExiusCart Backups
if exist "%USERPROFILE%\My Drive" (
    if not exist "%GDRIVE_PATH2%" mkdir "%GDRIVE_PATH2%"
    xcopy /E /I /Y /Q "%BACKUP_DIR%" "%GDRIVE_PATH2%\%BACKUP_NAME%" >nul
    echo [%BACKUP_DATE%] Google Drive (My Drive) sync OK >> "%LOG_FILE%"
)

:: ── 4. Keep only last 7 backups locally (delete older ones) ───────────────
echo [*] Cleaning old backups (keeping last 7 days)...
set COUNT=0
for /f "delims=" %%d in ('dir /b /ad /o-n "C:\ExiusCart\backups\exiuscart_backup_*" 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr 7 (
        rmdir /s /q "C:\ExiusCart\backups\%%d"
        echo [%BACKUP_DATE%] Deleted old backup: %%d >> "%LOG_FILE%"
    )
)

echo [%BACKUP_DATE%] Backup complete. Saved to: %BACKUP_DIR% >> "%LOG_FILE%"
echo.
echo [SUCCESS] Backup complete!
echo   Location: %BACKUP_DIR%
