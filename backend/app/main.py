import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .utils.db import init_db
from .routes import scan, reports, actions, settings as settings_route, ai, ws, dashboard

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "data", "winsec.db"))
init_db(DB_PATH)

app = FastAPI(title="Windows Security Audit Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ws.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Windows Security Audit Pro API"}
