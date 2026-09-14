@echo off
setlocal
set "ROOT=%~dp0"
set "NODE=%ROOT%runtime\node.exe"
if not exist "%NODE%" (
  echo Bundled Node.js runtime not found: %NODE%
  exit /b 1
)
if not exist "%ROOT%data" mkdir "%ROOT%data"
start "Linktracer" "%NODE%" "%ROOT%server\index.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8787"
echo Linktracer is running at http://localhost:8787
echo Close the Linktracer server window to stop it.
endlocal
