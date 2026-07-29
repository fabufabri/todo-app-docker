-- backend/db-init.sql
-- Este script se ejecuta AUTOMÁTICAMENTE la primera vez que se crea el
-- volumen de PostgreSQL (Docker lo monta en /docker-entrypoint-initdb.d/).
-- El usuario y la base de datos ya los crea el propio contenedor a partir
-- de las variables POSTGRES_USER / POSTGRES_DB / POSTGRES_PASSWORD, así
-- que acá solo creamos la tabla.

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO tasks (title, completed) VALUES
  ('Instalar Docker en el VPS', true),
  ('Levantar docker compose', true),
  ('Probar el pipeline de CI/CD', false);
