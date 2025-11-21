-- Script de inicialización de base de datos para Rep Drill
-- Este script se ejecuta automáticamente cuando se crea el contenedor de PostgreSQL

-- Crear la base de datos principal si no existe
SELECT 'CREATE DATABASE rep_drill' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rep_drill')\gexec

-- Conectar a la base de datos rep_drill
\c rep_drill;

-- Crear extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Configurar timezone
SET timezone = 'America/Santiago';

-- Mensaje de confirmación
\echo 'Base de datos rep_drill inicializada correctamente'