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

The legacy ETL pipeline runs on a host you control and targets PostgreSQL,
not the production D1 database. Its downloader currently contains example HUD
URLs. Replace and verify those sources and review the output before running
or scheduling imports. For production D1 imports, see [CLOUDFLARE.md](CLOUDFLARE.md#data-import).

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

### Host Scheduling

After verifying the sources and completing a successful manual import, use
Windows Task Scheduler or cron on a machine with Python and database access.
No schedule is installed by this repository.

On Windows, configure a task to run `cmd.exe` with arguments
`/c ""C:\path\to\debughomelessness.com\scripts\run-etl.bat""`.
Set its working directory to the project root, use an account with database
access, and choose a weekly Sunday trigger. Task Scheduler uses local time;
convert 02:00 UTC if you want to preserve the previous schedule.

On a Linux host configured for UTC, this cron entry runs Sundays at 02:00 UTC:

```cron
0 2 * * 0 /bin/bash /srv/debughomelessness.com/scripts/run-etl.sh >> /srv/debughomelessness.com/logs/etl.log 2>&1
```

Create `logs/` before adding the entry. Set `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, and `DB_PASSWORD` in the scheduled process's environment using your
host's protected configuration. The ETL scripts do not load `.env` themselves;
do not put passwords in a committed scheduler file. Both launchers enter the
project root and stop on a nonzero stage exit. Review logs after each run;
the legacy downloader can log download errors without a nonzero exit, so an
exit code alone does not establish that fresh data was imported.

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
