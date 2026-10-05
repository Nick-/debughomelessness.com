# API Documentation

## Base URL
Production: `https://debughomelessness.com` (Cloudflare Worker with D1).
Local Worker: `http://127.0.0.1:18787`.
Legacy Python scaffold: `http://localhost:8000`.

## Authentication
The Workers API is public and read-only. Only GET and HEAD are supported; writes
are performed through authenticated D1 administration and reviewed imports.
API errors are JSON, including unknown endpoints. Empty collections indicate no
data has been imported; missing CoCs or individual assessments return 404.

## Endpoints

### Health Check
```
GET /health
```
Returns API health status.
The Worker also checks that the D1 schema is accessible and returns 503 if it is not.

### Continuums of Care (CoC)

#### Get All CoCs
```
GET /api/coc/
```
Returns all Continuums of Care.

**Response:**
```json
[
  {
    "coc_id": "CA-501",
    "name": "Los Angeles County CoC",
    "state": "CA",
    "region_type": "Major City",
    "population": 10000000,
    "boundary_geojson": null
  }
]
```

#### Get Specific CoC
```
GET /api/coc/{coc_id}
```
Returns details for a specific CoC.

**Parameters:**
- `coc_id` (path): CoC identifier

#### Get CoC History
```
GET /api/coc/{coc_id}/history?years=5
```
Returns historical data for a CoC.

**Parameters:**
- `coc_id` (path): CoC identifier
- `years` (query): Calendar-year window ending at the CoC's latest available metric year (default: 5, allowed: 1–100)

### Metrics

#### Get All Metrics
```
GET /api/metrics/
```
Returns all available metrics.

**Response:**
```json
[
  {
    "metric_id": 1,
    "coc_id": "CA-501",
    "metric_type": "pit_count",
    "year": 2023,
    "value": 45000,
    "unit": "count",
    "source": "HUD Exchange"
  }
]
```

#### Get Specific Metric
```
GET /api/metrics/{metric_id}
```
Returns details for a specific metric.

#### Get CoC Metrics
```
GET /api/metrics/coc/{coc_id}?year=2023
```
Returns all metrics for a specific CoC, optionally filtered by year.

**Parameters:**
- `coc_id` (path): CoC identifier
- `year` (query): Optional year filter

#### Get Metrics by Type
```
GET /api/metrics/type/{metric_type}
```
Returns metrics filtered by type.

**Parameters:**
- `metric_type` (path): Metric type (pit_count, spm_length, spm_placement, spm_recidivism)

### Functional Zero

#### Get All Functional Zero Status
```
GET /api/functional-zero/
```
Returns Functional Zero status for all CoCs.

**Response:**
```json
[
  {
    "coc_id": "CA-501",
    "status": "not_achieved",
    "achieved_date": null,
    "current_population": 45000,
    "benchmark_population": 3000,
    "percentage_change": 1400.0,
    "last_updated": "2024-01-15"
  }
]
```

#### Get CoC Functional Zero Status
```
GET /api/functional-zero/{coc_id}
```
Returns Functional Zero status for a specific CoC.

#### Get Functional Zero Timeline
```
GET /api/functional-zero/{coc_id}/timeline
```
Returns timeline of Functional Zero progress for a CoC.

## Metric Types

- `pit_count`: Point-in-Time count of homeless individuals
- `spm_length`: System Performance Measure - length of homelessness
- `spm_placement`: System Performance Measure - placement rate
- `spm_recidivism`: System Performance Measure - recidivism rate

## Functional Zero Status Values

- `functional_zero`, `approaching`, `not_achieved`: stored project assessments.

The API returns the latest stored assessment per CoC and does not infer achievement
from absent data. The legacy rate thresholds are project measures, not official
Functional Zero certification. The timeline endpoint returns all stored assessments.

## Error Responses

All endpoints may return standard error responses:

```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- 200: Success
- 404: Resource not found
- 405: Method not allowed
- 422: Invalid query or path parameter
- 503: Database unavailable or not configured
