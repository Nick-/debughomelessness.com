@echo off
REM Start Frontend Development Server Script for Windows

echo Starting Homelessness KPI Tracker Frontend...

cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Start the development server
npm run dev