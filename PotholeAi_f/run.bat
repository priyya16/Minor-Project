@echo off
setlocal enabledelayedexpansion

:: Automatically change directory to the project root where this script resides
cd /d "%~dp0"

title PotholeAI - Road Surface Classifier

echo ================================================================
echo           PotholeAI - Road Surface Classification
echo ================================================================
echo.

:: 1. Detect existing working Python installation
set "PYTHON_EXE="

if exist "C:\Users\priyy\AppData\Local\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=C:\Users\priyy\AppData\Local\Programs\Python\Python311\python.exe"
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python 3.11 was not found on your system.
    echo Please ensure Python is installed and added to PATH.
    echo.
    pause
    exit /b 1
)

echo [INFO] Project directory: %CD%
echo [INFO] Python interpreter: %PYTHON_EXE%
echo.

:: 2. Check if server instance is already running on port 5000
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [NOTICE] A server instance is already running on port 5000.
    echo [NOTICE] Opening web application in browser...
    start http://localhost:5000
    echo.
    echo Application is accessible at: http://localhost:5000
    echo Press any key to close this launcher window...
    pause >nul
    exit /b 0
)

:: 3. Launch browser after a brief delay so Flask has time to bind to port 5000
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5000"

:: 4. Start the Flask server
echo [INFO] Starting Flask backend server on http://localhost:5000 ...
echo [INFO] Live prediction logs will appear below.
echo [INFO] To stop the server at any time, press Ctrl+C in this window.
echo ================================================================
echo.

"%PYTHON_EXE%" app.py

if !errorlevel! neq 0 (
    echo.
    echo ================================================================
    echo [ERROR] The application exited with code !errorlevel!.
    echo Please review the error messages above for details.
    echo ================================================================
    echo.
    pause
    exit /b !errorlevel!
)

pause
