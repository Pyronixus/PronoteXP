@echo off
REM This launcher creates the local Python environment, installs the project dependencies,
REM and starts the FastAPI server used by PronoteXP.

title PRONOTE Exporter Launcher

REM Display the startup banner for the local PRONOTE export environment.
echo ============================================================
echo      Starting the PRONOTE Exporter environment
echo ============================================================
echo.

echo [Progress 1/3] Preparing the Python environment...
if not exist "venv" (
    echo   > Creating the virtual environment...
    python -m venv venv
) else (
    echo   > Existing virtual environment found.
)

call venv\Scripts\activate.bat

echo.
echo [Progress 2/3] Installing dependencies...
pip install -r backend\requirements.txt --quiet

if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed.
    pause
    exit /b 1
)

echo.
echo [Progress 3/3] Starting the server...
echo.
echo ============================================================
echo Open your browser at: http://localhost:8000
echo ============================================================
echo.

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause