from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.coc_router import router as coc_router
from api.metrics_router import router as metrics_router
from api.functional_zero_router import router as functional_zero_router

app = FastAPI(
    title="Homelessness KPI Tracker API",
    description="API for tracking regional homelessness Key Performance Indicators",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(coc_router, prefix="/api/coc", tags=["Continuums of Care"])
app.include_router(metrics_router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(functional_zero_router, prefix="/api/functional-zero", tags=["Functional Zero"])

@app.get("/")
async def root():
    return {"message": "Homelessness KPI Tracker API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)