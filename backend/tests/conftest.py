import os
import pytest
from pathlib import Path


def _load_env_file(path: Path):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


# Load REACT_APP_BACKEND_URL from frontend/.env if not already set
_load_env_file(Path("/app/frontend/.env"))


# Allow @pytest.mark.asyncio with default loop scope
def pytest_collection_modifyitems(config, items):
    pass
