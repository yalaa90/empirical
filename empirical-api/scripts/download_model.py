from __future__ import annotations

import os
import sys
from pathlib import Path

from huggingface_hub import hf_hub_download

REPO = os.environ.get("QWEN_MODEL_REPO", "Qwen/Qwen1.5-1.8B-Chat-GGUF")
FILENAME = os.environ.get("QWEN_MODEL_FILE", "qwen1_5-1_8b-chat-q4_k_m.gguf")
MODELS_DIR = Path(os.environ.get("MODELS_DIR", "/models"))


def main() -> int:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    target = MODELS_DIR / FILENAME

    if target.is_file() and target.stat().st_size > 0:
        print(f"Model already present: {target}")
        return 0

    print(f"Downloading {REPO}/{FILENAME} -> {MODELS_DIR}")
    hf_hub_download(repo_id=REPO, filename=FILENAME, local_dir=str(MODELS_DIR))
    print(f"Downloaded: {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
