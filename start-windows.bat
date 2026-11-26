@echo off
cd /d %~dp0
if not exist .env (
  echo Missing .env file. Copy .env.example to .env and fill in your credentials first.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto fail
call npm run dev
goto end
:fail
echo Setup failed. Check Node.js/npm and your internet connection.
pause
:end
