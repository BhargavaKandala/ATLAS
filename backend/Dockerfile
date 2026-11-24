FROM python:3.12-slim
WORKDIR /atlas
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt ./requirements.txt
RUN --mount=type=secret,id=registry_ca \
    if [ -f /run/secrets/registry_ca ]; then export PIP_CERT=/run/secrets/registry_ca; fi; \
    pip install --no-cache-dir -r requirements.txt \
    && useradd --system --no-create-home atlas \
    && mkdir data && chown atlas data
COPY --chown=atlas:atlas backend ./backend
USER atlas
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
