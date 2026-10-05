# Homelessness KPI Tracker

An open-source dashboard and API for tracking regional homelessness Key Performance Indicators (KPIs) and monitoring progress toward Functional Zero. 

The dashboard and REST API serve imported aggregate homelessness records. The
repository also contains a legacy HUD ETL scaffold; its example download URLs
must be replaced with verified sources before automated ingestion can be used.

## Cloudflare deployment

The production deployment uses Cloudflare Workers for the React dashboard and
read-only API, with Cloudflare D1 storage. See [the deployment protocol](docs/CLOUDFLARE.md)
for authentication, local development, domain setup, GitHub Actions, and rollback.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Release with `npm run deploy`, then verify with `npm run smoke`.
The dashboard uses imported database records; no mock data is published.
The PostgreSQL/Python instructions below describe the legacy development setup.

---

## 🏗 System Architecture

The application is broken down into four core components:

1. **ETL Pipeline:** A scheduled GitHub Action that scrapes, cleans, and transforms static CSVs from the HUD Exchange into relational data.
2. **Database:** A PostgreSQL database structured around Continuums of Care (CoCs) geographic boundaries and yearly metrics.
3. **Backend API:** A Python REST API that calculates metrics like Functional Zero status and serves the dashboard.
4. **Frontend UI:** A React dashboard utilizing charting libraries to visualize historical trends and geographic data.

---

## 📊 Data Sources

This project relies on public data published by HUD. The ETL pipeline automatically monitors and ingests updates from:
* **Point-in-Time (PIT) Counts:** Annual counts of sheltered and unsheltered individuals.
* **System Performance Measures (SPM):** Metrics tracking the length of time homeless, successful placements, and recidivism rates.
* **HUD Open Data (GIS):** Regional boundary definitions for Continuums of Care.

---

## 🚀 Quick Start

### Prerequisites
* Python 3.10+
* PostgreSQL 15+
* Node.js 18+
* Git

### 1. Clone Repository
```bash
git clone https://github.com/Nick-/homelessness-kpi-tracker.git
cd homelessness-kpi-tracker
```

### 2. Set Up Database
```bash
# Create PostgreSQL database
createdb homelessness_kpi

# Run schema
psql -d homelessness_kpi -f database/schema.sql
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
```

### 4. Start Services

**Backend (Python):**
```bash
# On Windows
scripts\start-backend.bat

# On Unix/Mac
chmod +x scripts/start-backend.sh
./scripts/start-backend.sh
```

**Frontend (React):**
```bash
# On Windows
scripts\start-frontend.bat

# On Unix/Mac
chmod +x scripts/start-frontend.sh
./scripts/start-frontend.sh
```

**ETL Pipeline (Optional):**
```bash
# On Windows
scripts\run-etl.bat

# On Unix/Mac
chmod +x scripts/run-etl.sh
./scripts/run-etl.sh
```

### 5. Access Applications
- **Frontend Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

---

## 📁 Project Structure

```
homelessness-kpi-tracker/
├── backend/              # Python FastAPI backend
│   ├── api/             # API route handlers
│   ├── models/          # Pydantic data models
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── services/    # API service layer
│   └── public/          # Static assets
├── etl/                 # ETL pipeline
│   ├── scripts/         # Data processing scripts
│   └── config/          # ETL configuration
├── database/            # Database schema
│   ├── schema.sql       # PostgreSQL schema
│   ├── migrations/      # Database migrations
│   └── seeds/           # Seed data
├── docs/                # Documentation
│   ├── SETUP.md         # Setup guide
│   └── API.md           # API documentation
├── scripts/             # Utility scripts
│   ├── start-backend.bat/sh
│   ├── start-frontend.bat/sh
│   └── run-etl.bat/sh
└── .github/             # GitHub Actions
    └── workflows/       # CI/CD workflows
```

---

## 🔧 Development

### Manual Setup

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md)

### API Documentation

See [docs/API.md](docs/API.md) for complete API documentation.

### Running Tests

```bash
# Backend tests
pytest

# Frontend tests
npm test
```

### Code Formatting

```bash
# Backend
black backend/
flake8 backend/

# Frontend
npm run lint
```

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Data provided by the U.S. Department of Housing and Urban Development (HUD)
- Built with FastAPI, React, and PostgreSQL
