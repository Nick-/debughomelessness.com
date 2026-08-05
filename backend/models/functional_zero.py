from pydantic import BaseModel
from typing import Optional
from datetime import date

class FunctionalZeroStatus(BaseModel):
    coc_id: str
    status: str
    achieved_date: Optional[date] = None
    current_population: int
    benchmark_population: int
    percentage_change: float
    last_updated: date
    
    class Config:
        from_attributes = True