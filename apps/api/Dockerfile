FROM python:3.12-slim-bookworm

WORKDIR /app

# gcc: build psycopg2/bcrypt nếu cần; postgresql-client: pg_isready / debug.
# (ffmpeg đã bỏ — funnel-only không transcode media.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

EXPOSE 8000

# entrypoint: alembic upgrade head -> uvicorn (xem entrypoint.sh)
ENTRYPOINT ["./entrypoint.sh"]
