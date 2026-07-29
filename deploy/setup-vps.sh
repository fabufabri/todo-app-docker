#!/bin/bash
# setup-vps.sh
# Aprovisionamiento inicial del VPS (Ubuntu 22.04/24.04) para correr la app con Docker.
# Se ejecuta UNA sola vez, a mano, por SSH, como root/sudo.
#
# Uso:
#   chmod +x setup-vps.sh
#   sudo ./setup-vps.sh
set -e

echo ">>> 1. Actualizando el sistema"
apt update && apt upgrade -y

echo ">>> 2. Creando usuario de despliegue sin privilegios root"
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
fi
mkdir -p /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
echo "    -> Pegá la clave PÚBLICA que use GitHub Actions en /home/deploy/.ssh/authorized_keys"

echo ">>> 3. Instalando Docker Engine + Docker Compose plugin"
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo ">>> 4. Permitiendo que el usuario 'deploy' use Docker sin sudo"
usermod -aG docker deploy

echo ">>> 5. Instalando y activando el firewall UFW"
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ">>> 6. Instalando fail2ban (protección contra fuerza bruta en SSH)"
apt install -y fail2ban
systemctl enable fail2ban --now

echo ">>> 7. Creando carpetas del proyecto y de respaldos"
mkdir -p /home/deploy/todo-app
mkdir -p /var/backups/todo-db
chown -R deploy:deploy /home/deploy/todo-app

echo ""
echo "=================================================================="
echo " Listo. Docker está instalado. Próximos pasos:"
echo " 1) Cerrá esta sesión SSH y volvé a entrar como 'deploy' para que"
echo "    tome efecto el permiso del grupo docker: ssh deploy@TU_IP"
echo " 2) Cloná el repo en /home/deploy/todo-app"
echo " 3) Copiá .env.example a .env y completá la contraseña real"
echo " 4) docker compose up -d --build"
echo " 5) Configurá los secrets en GitHub (VPS_HOST, VPS_USER, VPS_SSH_KEY)"
echo "=================================================================="
