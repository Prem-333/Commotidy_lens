"""Create an explicit allowlisted release archive; exclude secrets and local state."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
output = root.parent / "CommodityLens-deploy.zip"
directories = ["api/app", "api/tests", "web/src", "web/public", "web/tests", "web/dist", "docs", "scripts", ".github"]
files = ["README.md", ".gitignore", ".env.example", "compose.yaml", "api/contracts.yaml", "api/requirements.txt",
         "api/requirements.lock", "api/Dockerfile", "api/.dockerignore", "web/package.json", "web/package-lock.json",
         "web/Dockerfile", "web/.dockerignore", "web/.prettierrc.json", "web/nginx.conf", "web/index.html",
         "web/tsconfig.json", "web/vite.config.ts", "web/playwright.config.ts"]
paths = [root / name for name in files]
for directory in directories:
    paths.extend(p for p in (root / directory).rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc")
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(set(paths)):
        if not path.is_file():
            raise FileNotFoundError(path)
        archive.write(path, Path("CommodityLens") / path.relative_to(root))
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(".zip.sha256").write_text(f"{digest}  {output.name}\n", encoding="utf-8")
print(f"Packaged {len(set(paths))} files: {output.name} ({output.stat().st_size:,} bytes)")
print(f"SHA-256: {digest}")
