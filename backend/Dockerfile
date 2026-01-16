# Используем официальный Python образ
FROM python:3.11

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем зависимости
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p /tmp/uploads

# Устанавливаем переменную окружения по умолчанию
ENV PORT=8000

# Запускаем приложение
CMD uvicorn main:app --host 0.0.0.0 --port $PORT