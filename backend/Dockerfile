FROM python:3.12-slim

# System deps for OpenCV + DeepFace
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download DeepFace models at build time so first request isn't slow
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Emotion'); DeepFace.build_model('Age'); DeepFace.build_model('Gender')" || true

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
