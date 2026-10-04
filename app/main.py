import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.config import settings
from app.ollama_client import OllamaClient
from app.pipeline import pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kyumei.main")

app = FastAPI(
    title="Kyūmei (究明)",
    description="Hardware and Device Diagnostics Reasoning API powered by local open-weight LLMs",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)


class DiagnoseRequest(BaseModel):
    symptom: str = Field(..., min_length=3, description="Plain text symptom description")
    mode: Optional[str] = Field(None, description="Pipeline mode: 'single' or 'staged'")


class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    target_model: str
    model_present: bool
    pipeline_mode: str
    available_models: List[str]
    error: Optional[str] = None


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Verify system connectivity to local Ollama daemon and open-weight model availability."""
    client = OllamaClient()
    conn_info = await client.check_connection()
    status_str = "ok" if conn_info["connected"] and conn_info["model_present"] else "degraded"
    
    return HealthResponse(
        status=status_str,
        ollama_connected=conn_info["connected"],
        target_model=conn_info["target_model"],
        model_present=conn_info["model_present"],
        pipeline_mode=settings.kyumei_pipeline_mode,
        available_models=conn_info["available_models"],
        error=conn_info["error"]
    )


@app.post("/api/diagnose")
async def diagnose(request: DiagnoseRequest):
    """Run hardware diagnostic reasoning pipeline."""
    try:
        report = await pipeline.run(request.symptom, mode=request.mode)
        return report
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during diagnosis pipeline execution")
        raise HTTPException(status_code=500, detail=f"Diagnostic error: {str(exc)}")


@app.get("/api/examples")
async def get_examples():
    """Return preloaded hardware challenge cases for 1-click testing."""
    examples_dir = settings.examples_dir
    examples = []
    
    if examples_dir.exists():
        for file in sorted(examples_dir.glob("*.json")):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    examples.append({
                        "id": file.stem,
                        "title": data.get("title", file.stem),
                        "symptom": data.get("symptom", ""),
                        "category": data.get("category", "General")
                    })
            except Exception as e:
                logger.warning("Could not read example file %s: %s", file, e)

    # Fallback default presets if directory empty
    if not examples:
        examples = [
            {
                "id": "thermal_laptop",
                "title": "Overheating & Loud Fan at Idle",
                "symptom": "Laptop gets very hot on the bottom and fan is loud while idle, shutting down after 20 minutes.",
                "category": "Thermal"
            },
            {
                "id": "gpu_artifacts",
                "title": "GPU Artifacts & Display Freezing",
                "symptom": "Playing 3D games causes checkered green/pink patterns on screen, then display freezes and driver crashes.",
                "category": "GPU / Display"
            },
            {
                "id": "swollen_battery",
                "title": "Trackpad Lifting / Swollen Battery",
                "symptom": "The laptop trackpad is pushing up and clicking is stiff. The bottom case seam is splitting open.",
                "category": "Safety Hazard"
            },
            {
                "id": "vague_wont_start",
                "title": "Ambiguous: Computer Won't Turn On",
                "symptom": "My computer is completely dead and won't turn on.",
                "category": "Thin Evidence"
            }
        ]

    return examples


# Serve static frontend files
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.kyumei_host,
        port=settings.kyumei_port,
        reload=True
    )
