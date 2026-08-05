# Development Setup Guide

This guide will help you set up the Homelessness KPI Tracker for local development.

## Prerequisites

- Python 3.10+
- PostgreSQL 15+
- Node.js 18+
- Git

## Database Setup

1. **Create PostgreSQL database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE homelessness_kpi;

# Exit
\q
```

2. **Run database schema:**
```bash
psql -U postgres -d homelessness_kpi -f database/schema.sql
```

## Backend Setup

1. **Navigate to project root:**
```bash
cd homelessness-kpi-tracker
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. **Run the backend server:**
```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000`

## Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install Node.js dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local if needed (defaults should work for local development)
```

4. **Run the frontend development server:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## ETL Pipeline Setup

The ETL pipeline can be run manually or scheduled via GitHub Actions.

### Manual ETL Run

1. **Ensure environment variables are set:**
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=homelessness_kpi
export DB_USER=postgres
export DB_PASSWORD=your_password
```

2. **Run the ETL pipeline:**
```bash
python etl/scripts/hud_data_downloader.py
python etl/scripts/data_processor.py
python etl/scripts/database_loader.py
```

### GitHub Actions Setup

1. **Add repository secrets:**
   - Go to your repository Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `DB_HOST`
     - `DB_PORT`
     - `DB_NAME`
     - `DB_USER`
     - `DB_PASSWORD`

2. **The workflow will run weekly on Sundays at 2 AM UTC**

## Development Workflow

### Running the full stack

1. **Start PostgreSQL database**
2. **Start backend API:**
```bash
cd backend
python main.py
```

3. **Start frontend (in separate terminal):**
```bash
cd frontend
npm run dev
```

### Running tests

```bash
# Backend tests
pytest

# Frontend tests (when implemented)
npm test
```

### Code formatting

```bash
# Backend
black backend/
flake8 backend/

# Frontend
npm run lint
```

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running
- Check that database credentials in `.env` are correct
- Verify database exists: `psql -U postgres -l`

### Frontend API connection issues
- Ensure backend is running on port 8000
- Check VITE_API_URL in `.env.local`
- Verify CORS settings in `backend/main.py`

### ETL pipeline issues
- Check logs in `logs/etl.log`
- Verify data directories exist: `data/raw`, `data/processed`
- Ensure network connectivity to HUD Exchange

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [HUD Exchange](https://www.hudexchange.info/)