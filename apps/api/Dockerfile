FROM python:3.12.9-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /srv/lumen-api

RUN groupadd --system lumen && useradd --system --gid lumen --home /srv/lumen-api lumen

COPY pyproject.toml ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic

RUN pip install --upgrade pip && pip install .

USER lumen

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD lumen-api healthcheck --url "http://127.0.0.1:${PORT:-8080}/healthz"

CMD ["sh", "-c", "lumen-api migrate && exec lumen-api serve --host 0.0.0.0 --port ${PORT:-8080}"]
