"""Generate local deployment secrets without printing or overwriting them."""
from pathlib import Path
import secrets
path = Path(__file__).resolve().parents[1] / ".env"
with path.open("x", encoding="utf-8") as stream:
    stream.write(f"DB_PASSWORD={secrets.token_hex(32)}\nINGEST_TOKEN={secrets.token_hex(32)}\nDATA_MODE=sample\nWEB_PORT=8080\n")
try:
    path.chmod(0o600)
except OSError:
    pass
print("Created .env with private random values. Keep it out of version control.")
