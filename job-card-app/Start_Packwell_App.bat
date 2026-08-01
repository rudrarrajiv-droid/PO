@echo off
echo =======================================================
echo     Starting Packwell Job Card Management System
echo =======================================================

echo.
echo [1/2] Starting Backend Server...
start "Packwell Backend" cmd /k "cd /d D:\po\job-card-app\backend && npx tsx src\index.ts"

echo.
echo [2/2] Starting Frontend Server...
start "Packwell Frontend" cmd /k "cd /d D:\po\job-card-app\frontend && npm run dev"

echo.
echo Waiting for servers to start...
timeout /t 5 /nobreak >nul

echo.
echo Opening the application in your default web browser...
start http://localhost:5173

echo.
echo Done! 
echo.
echo Note: Two black command prompt windows have opened. 
echo You can minimize them, but DO NOT close them while using the application.
pause
