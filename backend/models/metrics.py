from pydantic import BaseModel
from typing import Optional
from enum import Enum

class MetricType(str, Enum):
    PIT_COUNT = "pit_count"
    SPM_LENGTH = "spm_length"
    SPM_PLACEMENT = "spm_placement"
    SPM_RECIDIVISM = "spm_recidivism"
    FUNCTIONAL_ZERO = "functional_zero"

class Metric(BaseModel):
    metric_id: str
    coc_id: str
    metric_type: MetricType
    year: int
    value: float
    unit: str
    source: str
    
    class Config:
        from_attributes = True