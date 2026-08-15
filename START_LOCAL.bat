@echo off
setlocal
cd /d "%~dp0"
title DelightFilm Local Dev :5173

echo [DelightFilm] Local UI starting on http://localhost:5173
echo.

if not exist "node_modules\tailwindcss\package.json" (
  echo Installing required packages ^(first run or UI engine update^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    echo Copy this window text and send it to ChatGPT.
    pause
    exit /b 1
  )
) else (
  echo Packages OK.
)

echo.
echo Starting Vite. Keep this window open.
call npm run dev

pause
