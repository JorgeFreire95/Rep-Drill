FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Crear directorio para archivos estáticos
RUN mkdir -p /app/staticfiles /app/media

# Exponer puerto
EXPOSE 8000

# Ejecutar migraciones y recolectar estáticos al iniciar (sin makemigrations en producción)
CMD ["sh", "-c", "python manage.py migrate --noinput; python manage.py collectstatic --noinput; gunicorn --bind 0.0.0.0:8000 --workers 3 --timeout 120 servicio_analytics.wsgi:application"]
