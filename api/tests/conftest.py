import os
import tempfile
from pathlib import Path
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'tests.db'}"
os.environ["DATA_MODE"] = "sample"
os.environ["INGEST_TOKEN"] = "test-only-operator-token"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import read_quotes
from app.analytics import normalize

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="session")
def sample(client):
    return normalize(read_quotes("sample"))
