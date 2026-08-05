# Development Guide

This guide covers development practices and workflows for the Homelessness KPI Tracker project.

## Code Style

### Python (Backend)
- Follow PEP 8 guidelines
- Use Black for code formatting
- Maximum line length: 88 characters
- Use meaningful variable and function names

### JavaScript/React (Frontend)
- Follow Airbnb JavaScript Style Guide
- Use 2 spaces for indentation
- Prefer functional components with hooks
- Use meaningful component and prop names

## Git Workflow

### Branch Naming
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `docs/` - Documentation updates

### Commit Messages
Follow conventional commits format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(api): add functional zero timeline endpoint

- Added new endpoint to retrieve historical functional zero status
- Implemented timeline data aggregation
- Added unit tests for timeline calculation
```

## Testing

### Backend Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api.py

# Run with coverage
pytest --cov=backend --cov-report=html
```

### Frontend Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Database Migrations

When modifying the database schema:

1. Create a new migration file in `database/migrations/`
2. Name it with timestamp and description: `YYYYMMDD_description.sql`
3. Include both UP and DOWN migration steps
4. Test migrations on a local database first

Example migration:
```sql
-- UP: Add new column
ALTER TABLE metrics ADD COLUMN data_source VARCHAR(100);

-- DOWN: Remove column
ALTER TABLE metrics DROP COLUMN data_source;
```

## API Development

When adding new API endpoints:

1. Define Pydantic models in `backend/models/`
2. Create route handlers in `backend/api/`
3. Add corresponding service logic in `backend/services/`
4. Update API documentation in `docs/API.md`
5. Add tests for new endpoints

## Frontend Development

When adding new features:

1. Create components in `frontend/src/components/`
2. Create pages in `frontend/src/pages/`
3. Add API calls to `frontend/src/services/api.js`
4. Update routing in `frontend/src/App.jsx`
5. Add appropriate styling

## ETL Pipeline Development

When modifying the ETL pipeline:

1. Update scripts in `etl/scripts/`
2. Test with sample data first
3. Update configuration in `etl/config/etl_config.yaml`
4. Test database loading procedures
5. Update GitHub Actions workflow if needed

## Performance Considerations

### Backend
- Use database indexes for frequently queried columns
- Implement pagination for large datasets
- Cache computed results where appropriate
- Use connection pooling for database connections

### Frontend
- Implement lazy loading for large datasets
- Use React.memo for expensive components
- Optimize re-renders with proper dependency arrays
- Implement code splitting for large bundles

## Security Best Practices

1. Never commit sensitive data (API keys, passwords)
2. Use environment variables for configuration
3. Validate all user inputs
4. Implement rate limiting for API endpoints
5. Keep dependencies updated
6. Use HTTPS in production

## Debugging

### Backend Debugging
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python backend/main.py
```

### Frontend Debugging
```bash
# Start with React DevTools
npm run dev
```

### Database Debugging
```bash
# Connect to database
psql -d homelessness_kpi

# Check query performance
EXPLAIN ANALYZE SELECT * FROM metrics;
```

## Deployment

### Backend Deployment
1. Set environment variables in production
2. Run database migrations
3. Build and deploy Docker container
4. Configure reverse proxy (nginx)
5. Set up SSL certificates

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Deploy static files to web server
3. Configure environment variables
4. Set up CDN for static assets

## Monitoring

### Application Monitoring
- Set up logging aggregation
- Monitor API response times
- Track error rates
- Monitor database performance

### Data Quality Monitoring
- Validate ETL pipeline outputs
- Monitor data freshness
- Check for data anomalies
- Validate functional zero calculations

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [HUD Exchange](https://www.hudexchange.info/)