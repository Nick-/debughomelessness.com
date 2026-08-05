#!/bin/bash

# Start Frontend Development Server Script

echo "Starting Homelessness KPI Tracker Frontend..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
npm run dev