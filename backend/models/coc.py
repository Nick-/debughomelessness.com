from pydantic import BaseModel
from typing import Optional

class ContinuumOfCare(BaseModel):
    coc_id: str
    name: str
    state: str
    region_type: str
    population: Optional[int] = None
    boundary_geojson: Optional[dict] = None
    
    class Config:
        from_attributes = True