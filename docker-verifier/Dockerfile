FROM nginx:alpine

# Copiar el verificador HTML desde el directorio public
COPY public/verifier.html /usr/share/nginx/html/verifier.html
COPY public/README.md /usr/share/nginx/html/README.md

# Crear página de índice que redirige al verificador
RUN echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/verifier.html"></head><body><a href="/verifier.html">Ir al Verificador</a></body></html>' > /usr/share/nginx/html/index.html

# Configurar nginx para servir el verificador con CORS habilitado
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index verifier.html index.html; \
    \
    # Habilitar CORS para todas las respuestas \
    add_header Access-Control-Allow-Origin * always; \
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always; \
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, Accept" always; \
    add_header Access-Control-Allow-Credentials true always; \
    \
    # Manejar preflight requests \
    if ($request_method = OPTIONS) { \
        add_header Access-Control-Allow-Origin * always; \
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always; \
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, Accept" always; \
        add_header Access-Control-Max-Age 1728000; \
        add_header Content-Type "text/plain charset=UTF-8"; \
        add_header Content-Length 0; \
        return 204; \
    } \
    \
    location / { \
        try_files $uri $uri/ /verifier.html; \
    } \
    \
    # Cache para archivos estáticos \
    location ~* \.(html|css|js)$ { \
        expires 1h; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

