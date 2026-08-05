# API Documentation

## Base URL
`http://localhost:8000`

## Authentication
Currently no authentication is required. This should be added for production use.

## Endpoints

### Health Check
```
GET /health
```
Returns API health status.

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
- `years` (query): Number of years of history (default: 5)

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

- `functional_zero`: Fewer than 3 people per 10,000 population
- `approaching`: Fewer than 5 people per 10,000 population
- `not_achieved`: More than 5 people per 10,000 population

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
- 500: Internal server error