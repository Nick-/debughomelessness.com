from fastapi import APIRouter, HTTPException
from typing import List, Optional
from models.metrics import Metric

router = APIRouter()

@router.get("/coc/{coc_id}")
async def get_coc_metrics(coc_id: str, year: Optional[int] = None):
    """Get all metrics for a specific CoC, optionally filtered by year"""
    # TODO: Implement database query
    return {"coc_id": coc_id, "year": year, "metrics": []}

@router.get("/type/{metric_type}")
async def get_metrics_by_type(metric_type: str):
    """Get metrics by type (PIT, SPM, etc.)"""
    # TODO: Implement database query
    return {"metric_type": metric_type, "metrics": []}

@router.get("/", response_model=List[Metric])
async def get_all_metrics():
    """Get all available metrics"""
    # TODO: Implement database query
    return []

@router.get("/{metric_id}", response_model=Metric)
async def get_metric(metric_id: str):
    """Get a specific metric by ID"""
    # TODO: Implement database query
    raise HTTPException(status_code=404, detail="Metric not found")