FROM python:3.12-slim

RUN pip install --no-cache-dir "huggingface_hub[hf-transfer]>=0.30,<1"

COPY scripts/download_model.py /usr/local/bin/download_model.py

ENTRYPOINT ["python", "/usr/local/bin/download_model.py"]
