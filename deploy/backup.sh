#!/bin/bash
# backup.sh
# Genera un respaldo de la base de datos que corre DENTRO del contenedor 'todo_db',
# usando "docker exec" (no hace falta tener psql instalado en el host).
#
# Programar en cron, por ejemplo todos los días a las 3 AM:
#   crontab -e
#   0 3 * * * /home/deploy/todo-app/deploy/backup.sh >> /var/log/todo-backup.log 2>&1

set -e

BACKUP_DIR="/var/backups/todo-db"
DATE=$(date +%F_%H-%M-%S)
FILE="$BACKUP_DIR/todo_db_$DATE.sql.gz"

# Carga las variables DB_USER / DB_NAME desde el .env del proyecto
set -a
source /home/deploy/todo-app/.env
set +a

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando respaldo..."
docker exec todo_db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "[$(date)] Respaldo creado: $FILE"

# Elimina respaldos con más de 7 días
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] Respaldos antiguos eliminados (>7 días)."
