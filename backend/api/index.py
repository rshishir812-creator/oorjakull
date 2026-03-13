import sys
from pathlib import Path

# Vercel runs the function from the project root (backend/).
# Ensure that root is on sys.path so `from app.…` imports resolve.
_backend_root = str(Path(__file__).resolve().parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.main import app  # noqa: E402

# Vercel's Python runtime looks for a variable called `app` (ASGI) or `handler`.
# FastAPI is ASGI, so exporting `app` is sufficient.
