import os
from pathlib import Path
import yaml
from pydantic import BaseModel, Field

class ContractSpec(BaseModel):
    name: str
    lot_size_grams: float = Field(gt=0)
    quote_unit_grams: float = Field(gt=0)
    purity: float = Field(gt=0, le=1)
    location: str
    verified: bool = False
    expiry_cycle: str
    source: str

SPEC_PATH = Path(os.getenv("CONTRACTS_FILE", Path(__file__).parents[1] / "contracts.yaml"))
SPECS = {k: ContractSpec(**v) for k, v in yaml.safe_load(SPEC_PATH.read_text()).items()}
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./commoditylens.db")
DATA_MODE = os.getenv("DATA_MODE", "sample")
if DATA_MODE not in {"sample", "imported"}:
    raise ValueError("DATA_MODE must be sample or imported")
ADMIN_TOKEN = os.getenv("INGEST_TOKEN", "")
