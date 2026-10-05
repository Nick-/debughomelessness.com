@echo off
setlocal
cd /d "%~dp0.."
REM Run ETL Pipeline Script for Windows

echo Running HUD Data ETL Pipeline...

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat
if errorlevel 1 exit /b 1

REM Install dependencies if needed
if not exist "venv\.installed" (
    echo Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 exit /b 1
    type nul > venv\.installed
)

REM Create data directories
if not exist "data\raw" mkdir data\raw
if not exist "data\processed" mkdir data\processed
if not exist "logs" mkdir logs

REM Run ETL pipeline
echo Downloading HUD data...
python etl\scripts\hud_data_downloader.py
if errorlevel 1 exit /b 1

echo Processing data...
python etl\scripts\data_processor.py
if errorlevel 1 exit /b 1

echo Loading data into database...
python etl\scripts\database_loader.py
if errorlevel 1 exit /b 1

echo ETL pipeline completed!
