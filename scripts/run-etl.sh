#!/bin/bash

# Run ETL Pipeline Script

echo "Running HUD Data ETL Pipeline..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Create data directories
mkdir -p data/raw
mkdir -p data/processed
mkdir -p logs

# Run ETL pipeline
echo "Downloading HUD data..."
python etl/scripts/hud_data_downloader.py

echo "Processing data..."
python etl/scripts/data_processor.py

echo "Loading data into database..."
python etl/scripts/database_loader.py

echo "ETL pipeline completed!"