@echo off
REM CareerPilot — one-click dev launcher for Windows.
REM Starts the FastAPI backend on :8000 and the Next.js frontend on :3000
REM in two separate terminal windows.

setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo.
echo ============================================
echo  CareerPilot — starting dev servers
echo ============================================
echo  Backend  -> http://localhost:8000
echo  Frontend -> http://localhost:3000
echo ============================================
echo.

REM --- Backend ---
if not exist "%BACKEND%\venv\Scripts\activate.bat" (
  echo [ERROR] Backend virtualenv not found.
  echo Run:  cd backend ^&^& python -m venv venv ^&^& venv\Scripts\activate ^&^& pip install -r requirements.txt
  exit /b 1
)
if not exist "%BACKEND%\.env" (
  echo [WARN] backend\.env not found. Copying .env.example to .env
  copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
  echo [WARN] Edit backend\.env with your real GROQ_API_KEY, SUPABASE_URL, SUPABASE_KEY
)

start "CareerPilot Backend" cmd /k "cd /d %BACKEND% && call venv\Scripts\activate && uvicorn main:app --reload --port 8000"

REM --- Frontend ---
if not exist "%FRONTEND%\node_modules" (
  echo [WARN] node_modules missing — running npm install first. This may take a minute.
  start /wait "CareerPilot npm install" cmd /c "cd /d %FRONTEND% && npm install"
)

start "CareerPilot Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo Both servers starting. Two new terminal windows have opened.
echo Close those windows to stop the servers.
echo.
endlocal
