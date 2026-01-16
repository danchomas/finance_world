FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements
COPY requirements.txt .

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p /tmp/uploads/product_images

# Открываем порт
EXPOSE 8000

# Запускаем приложение (Railway будет передавать PORT через env)
CMD ["python", "main.py"]