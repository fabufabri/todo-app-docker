# frontend/Dockerfile
FROM nginx:1.27-alpine

# Borramos la config por defecto y ponemos la nuestra
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los archivos estáticos de la SPA
COPY index.html style.css app.js /usr/share/nginx/html/

EXPOSE 80
