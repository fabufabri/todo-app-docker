# To-Do List — Despliegue con Docker en VPS gratuito (Guía paso a paso)

Versión **Docker** del proyecto. Todo el código de la app es igual; lo que cambia es
cómo se instala y se despliega: en vez de instalar Node/Nginx/Postgres a mano, cada uno
corre en su propio contenedor, definidos en `docker-compose.yml`.

## 0. Arquitectura

```
Internet
   │  HTTP :80
   ▼
┌────────────────────────────────────────────┐
│  VPS con Docker                             │
│                                              │
│  ┌───────────────┐   red interna docker     │
│  │ contenedor:web │  (nginx, puerto 80       │
│  │   (Nginx)      │   publicado al exterior) │
│  └───────┬────────┘                         │
│          │ proxy_pass /api → backend:3000   │
│          ▼                                  │
│  ┌────────────────┐                         │
│  │contenedor:backend│  (Node/Express, :3000  │
│  │                 │   NO publicado afuera)  │
│  └───────┬─────────┘                        │
│          ▼                                  │
│  ┌────────────────┐                         │
│  │ contenedor:db   │  (PostgreSQL, :5432     │
│  │                 │   NO publicado afuera)  │
│  └────────────────┘                         │
└────────────────────────────────────────────┘
```

Los 3 contenedores se comunican entre sí por nombre (`backend`, `db`) usando la red
interna que crea `docker-compose` automáticamente. Solo el puerto 80 del contenedor
`web` (Nginx) queda expuesto a Internet.

---

## PASO 1 — Conseguir un VPS gratuito (Oracle Cloud Free Tier)

1. Creá una cuenta en https://www.oracle.com/cloud/free/
2. Al crear la instancia (VM), elegí:
   - Imagen: **Ubuntu 22.04**
   - Forma (shape): **Ampere (ARM), "Always Free"** — 4 OCPU / 24 GB RAM sin costo
3. Descargá la clave SSH que te ofrece Oracle al crear la VM (o subí la tuya).
4. Anotá la **IP pública** de la instancia.
5. En la consola de Oracle, andá a la VCN de la instancia y abrí en el "Security List"
   los puertos **80** y **443** entrantes (Oracle tiene su propio firewall además del
   de Ubuntu, hay que abrirlo en los dos lados).

---

## PASO 2 — Entrar al VPS e instalar Docker

```bash
ssh -i tu_clave.key ubuntu@TU_IP_PUBLICA
```

Subí `deploy/setup-vps.sh` al VPS (copiá y pegá el contenido en un archivo nuevo) y ejecutá:
```bash
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

Esto instala Docker Engine, Docker Compose, UFW (firewall) y fail2ban, y crea el
usuario `deploy`.

---

## PASO 3 — Clave SSH para GitHub Actions

En tu computadora:
```bash
ssh-keygen -t ed25519 -C "github-actions" -f github_deploy_key -N ""
```
Pegá el contenido de `github_deploy_key.pub` en el VPS, dentro de:
```
/home/deploy/.ssh/authorized_keys
```

---

## PASO 4 — Subir el proyecto a GitHub

```bash
cd todo-app-docker
git init
git add .
git commit -m "Proyecto inicial con Docker"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/todo-app-docker.git
git push -u origin main
```

---

## PASO 5 — Configurar los Secrets en GitHub

**Settings → Secrets and variables → Actions → New repository secret**

| Nombre | Valor |
|---|---|
| `VPS_HOST` | IP pública del VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | contenido completo de `github_deploy_key` (la clave privada) |

---

## PASO 6 — Primer levantamiento manual (para dejar todo funcionando)

Como usuario `deploy` en el VPS:
```bash
cd /home/deploy/todo-app
git clone https://github.com/TU_USUARIO/todo-app-docker.git .
cp .env.example .env
nano .env          # completá una contraseña real en DB_PASSWORD
docker compose up -d --build
docker compose ps  # verificá que los 3 contenedores estén "Up"
```

Entrá desde el navegador a `http://TU_IP_PUBLICA` — la app ya debería funcionar.

---

## PASO 7 — Probar el CI/CD

En tu compu, modificá algo (ej. `frontend/index.html`) y:
```bash
git add .
git commit -m "Prueba de despliegue automático"
git push
```

En GitHub → pestaña **Actions**, vas a ver el pipeline: se conecta por SSH,
sincroniza el código con `rsync`, reconstruye las imágenes con
`docker compose up -d --build` y verifica que responda. Todo sin tocar el VPS a mano.

---

## PASO 8 — Backups automáticos

```bash
chmod +x /home/deploy/todo-app/deploy/backup.sh
crontab -e
```
Agregar:
```
0 3 * * * /home/deploy/todo-app/deploy/backup.sh >> /var/log/todo-backup.log 2>&1
```

---

## PASO 9 — Verificar firewall

```bash
sudo ufw status
```
Deberían estar permitidos solo: OpenSSH, 80/tcp y 443/tcp.

---

## Comandos útiles de Docker (para el informe / demo en clase)

```bash
docker compose ps                 # ver estado de los 3 contenedores
docker compose logs -f backend    # ver logs del backend en vivo
docker compose logs -f db         # ver logs de la base de datos
docker compose down               # apagar todo
docker compose up -d --build      # reconstruir y levantar
docker exec -it todo_db psql -U todo_user -d todo_db   # entrar a la base de datos
```

## Diferencias clave respecto a la versión sin Docker

| Aspecto | Sin Docker | Con Docker |
|---|---|---|
| Instalación de Nginx/Node/Postgres | `apt install` uno por uno | Ya vienen en las imágenes oficiales |
| Aislamiento | Todo corre directo en el SO | Cada servicio en su contenedor, aislado |
| "Build" del pipeline | `npm install` en el VPS | `docker compose up -d --build` reconstruye las imágenes |
| Puertos internos expuestos | Node y Postgres escuchaban en localhost del VPS | Node y Postgres NI SIQUIERA están mapeados al host; solo existen en la red interna de Docker |
| Reinicio ante fallas | systemd (`Restart=on-failure`) | Docker (`restart: unless-stopped`) |
| Persistencia de datos | Postgres instalado en el disco del VPS | Volumen con nombre `pgdata` (persiste aunque se borren los contenedores) |
