import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Ollama local connection
    ollama_host: str = "http://localhost:11434"
    kyumei_model: str = "gemma4:e2b"
    
    # Pipeline execution mode: "single" | "staged"
    kyumei_pipeline_mode: str = "single"
    
    # Inference parameters
    kyumei_temperature: float = 0.2
    kyumei_request_timeout: float = 120.0  # seconds
    
    # HTTP server configuration
    kyumei_host: str = os.environ.get("HOST", "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    kyumei_port: int = int(os.environ.get("PORT", "8000"))
    
    # Project Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    
    @property
    def skill_path(self) -> Path:
        return self.base_dir / "skill" / "SKILL.md"
        
    @property
    def schema_path(self) -> Path:
        return self.base_dir / "skill" / "schema.json"
        
    @property
    def references_dir(self) -> Path:
        return self.base_dir / "skill" / "references"
        
    @property
    def examples_dir(self) -> Path:
        return self.base_dir / "examples"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
