import pytest
from app.ingestion import parse_csv
from app.db import read_quotes

CSV = b'TradDt,TckrSymb,FininstrmActlXpryDt,XpryDt,SttlmPric,OpnPric,TtlTradgVol,OpnIntrst,OptnTp,StrkPric\n2026-10-08,GOLDM,2026-10-28,2026-10-29,99500,99400,1500,6000,,0\n'

def test_actual_expiry_and_volume_units():
    frame = parse_csv(CSV)
    assert str(frame.iloc[0].expiry.date()) == "2026-10-28"
    assert str(frame.iloc[0].original_expiry.date()) == "2026-10-29"
    assert frame.iloc[0].volume == 1500

def test_fallback_expiry_when_actual_blank():
    frame = parse_csv(CSV.replace(b"GOLDM,2026-10-28,", b"GOLDM,,"))
    assert str(frame.iloc[0].expiry.date()) == "2026-10-29"

def test_ambiguous_numeric_dates_are_rejected():
    with pytest.raises(ValueError, match="Ambiguous"):
        parse_csv(CSV.replace(b"2026-10-08", b"08/10/2026"))
    assert str(parse_csv(CSV.replace(b"2026-10-08", b"08-Oct-2026")).iloc[0].date.date()) == "2026-10-08"

def test_options_excluded():
    with pytest.raises(ValueError, match="No supported"):
        parse_csv(CSV.replace(b",,0", b",CE,90000"))

def test_negative_and_fractional_volume_rejected():
    for value in (b"-3", b"1.5", b"NaN", b"inf"):
        with pytest.raises(ValueError, match="Invalid data"):
            parse_csv(CSV.replace(b"1500", value))

def test_close_is_not_settlement():
    with pytest.raises(ValueError, match="Missing settle"):
        parse_csv(CSV.replace(b"SttlmPric", b"ClsPric"))

def test_conflicting_duplicates_rejected():
    row = CSV.splitlines()[1]
    with pytest.raises(ValueError, match="Conflicting duplicate"):
        parse_csv(CSV + row.replace(b"99500", b"99501") + b"\n")
    assert len(parse_csv(CSV + row + b"\n")) == 1

def test_authenticated_idempotent_import_and_separation(client):
    assert client.post("/api/ingest", files={"file": ("day.csv", CSV)}).status_code == 401
    headers = {"Authorization": "Bearer test-only-operator-token"}
    first = client.post("/api/ingest", files={"file": ("day.csv", CSV)}, headers=headers)
    second = client.post("/api/ingest", files={"file": ("day.csv", CSV)}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["duplicate"] is False
    assert second.json()["duplicate"] is True
    assert len(read_quotes("imported")) == 1
    assert client.get("/api/health").json()["source"] == "sample"
    bad = CSV.replace(b"1500", b"-99")
    assert client.post("/api/ingest", files={"file": ("bad.csv", bad)}, headers=headers).status_code == 422
    assert len(read_quotes("imported")) == 1

@pytest.mark.parametrize("path", ["/api/health", "/api/contracts", "/api/normalized", "/api/signals", "/api/spreads", "/api/term-structure", "/api/liquidity", "/api/openapi.json"])
def test_api_contracts(client, path):
    response = client.get(path)
    assert response.status_code == 200, response.text
    assert "NaN" not in response.text
    assert response.headers["X-Content-Type-Options"] == "nosniff"

def test_backtest_api_and_validation(client):
    response = client.post("/api/backtest", json={"pair": "GOLDM/GOLDTEN", "month": "2026-10"})
    assert response.status_code == 200, response.text
    assert response.json()["source"] == "sample"
    assert client.post("/api/backtest", json={"lookback": 1}).status_code == 422
    assert client.post("/api/backtest", json={"entry_z": 1, "exit_z": 2}).status_code == 422
    assert client.post("/api/backtest", json={"pair": "GOLDM/GOLDPETAL"}).status_code == 422
    assert client.get("/api/normalized?date=1900-01-01").status_code == 404
    assert client.get("/api/spreads?pair=INVALID/GOLDM").status_code == 422
    assert client.get("/api/signals?window=0").status_code == 422
