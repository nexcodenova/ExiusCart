@echo off
title ExiusCart - Step 2: Install Backend
color 0A
echo.
echo ============================================
echo   ExiusCart Setup - Step 2: Backend
echo ============================================
echo.

:: Create app directory
if not exist "C:\ExiusCart" mkdir "C:\ExiusCart"
if not exist "C:\ExiusCart\backend" mkdir "C:\ExiusCart\backend"
if not exist "C:\ExiusCart\uploads" mkdir "C:\ExiusCart\uploads"
if not exist "C:\ExiusCart\backups" mkdir "C:\ExiusCart\backups"

:: Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] Python not found. Downloading Python 3.11...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe' -OutFile '%TEMP%\python_installer.exe' -UseBasicParsing"
    "%TEMP%\python_installer.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    :: Refresh PATH
    call refreshenv 2>nul || set PATH=%PATH%;C:\Program Files\Python311;C:\Program Files\Python311\Scripts
)

echo [*] Copying backend files...
:: Copy backend folder next to this script into C:\ExiusCart\backend
xcopy /E /I /Y "%~dp0backend" "C:\ExiusCart\backend" >nul

cd /d "C:\ExiusCart\backend"

echo [*] Installing Python dependencies...
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)

:: Create .env file with local database config
echo [*] Creating environment config...
(
echo DATABASE_URL=postgresql://exiuscart:ExiusCart@2024@localhost:5432/exiuscart_db
echo SECRET_KEY=exiuscart-local-secret-change-this-in-production
echo ALGORITHM=HS256
echo ACCESS_TOKEN_EXPIRE_MINUTES=10080
echo APP_NAME=ExiusCart
echo API_V1_PREFIX=/api/v1
echo UPLOAD_DIR=C:/ExiusCart/uploads
) > "C:\ExiusCart\backend\.env"

echo [*] Creating database tables...
cd /d "C:\ExiusCart\backend"
python -c "from app.core.database import engine, Base; import app.models; Base.metadata.create_all(bind=engine); print('Tables created!')"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to create database tables. Is PostgreSQL running?
    pause
    exit /b 1
)

echo [*] Creating default admin account...
python -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
db = SessionLocal()
existing = db.query(User).filter(User.email == 'admin@exiuscart.com').first()
if not existing:
    admin = User(email='admin@exiuscart.com', hashed_password=get_password_hash('Admin@123'), full_name='Shop Admin', is_active=True, is_superuser=False)
    db.add(admin)
    db.commit()
    print('Admin account created: admin@exiuscart.com / Admin@123')
else:
    print('Admin account already exists.')
db.close()
"

echo.
echo [*] Installing backend as Windows Service (auto-starts on boot)...

:: Install NSSM (Non-Sucking Service Manager) to run Python as a service
if not exist "C:\ExiusCart\nssm.exe" (
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip' -UseBasicParsing; Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TEMP%\nssm' -Force; Copy-Item '%TEMP%\nssm\nssm-2.24\win64\nssm.exe' 'C:\ExiusCart\nssm.exe'"
)

:: Remove old service if exists
"C:\ExiusCart\nssm.exe" stop ExiusCartBackend 2>nul
"C:\ExiusCart\nssm.exe" remove ExiusCartBackend confirm 2>nul

:: Install new service
"C:\ExiusCart\nssm.exe" install ExiusCartBackend python
"C:\ExiusCart\nssm.exe" set ExiusCartBackend AppDirectory "C:\ExiusCart\backend"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend AppParameters "-m uvicorn app.main:app --host 127.0.0.1 --port 8000"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend AppEnvironmentExtra "DATABASE_URL=postgresql://exiuscart:ExiusCart@2024@localhost:5432/exiuscart_db" "SECRET_KEY=exiuscart-local-secret-change-this-in-production"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend DisplayName "ExiusCart Backend API"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend Description "ExiusCart FastAPI backend server"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend Start SERVICE_AUTO_START
"C:\ExiusCart\nssm.exe" set ExiusCartBackend AppStdout "C:\ExiusCart\logs\backend.log"
"C:\ExiusCart\nssm.exe" set ExiusCartBackend AppStderr "C:\ExiusCart\logs\backend-error.log"

if not exist "C:\ExiusCart\logs" mkdir "C:\ExiusCart\logs"

:: Start the service
"C:\ExiusCart\nssm.exe" start ExiusCartBackend

echo.
echo [*] Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Test if backend is running
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing; if ($r.StatusCode -eq 200) { Write-Host '[SUCCESS] Backend is running!' } } catch { Write-Host '[WARNING] Backend may still be starting...' }"

echo.
echo [SUCCESS] Backend installed as Windows Service!
echo   API runs at: http://localhost:8000
echo   Docs:        http://localhost:8000/docs
echo   Auto-starts on Windows boot.
echo.
pause
