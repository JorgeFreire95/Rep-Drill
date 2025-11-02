#!/bin/bash
# Script para configurar SSL/TLS con Let's Encrypt
# Uso: sudo bash scripts/setup_ssl.sh tudominio.com

set -e

DOMAIN=$1
EMAIL=${2:-"admin@$DOMAIN"}

if [ -z "$DOMAIN" ]; then
    echo "❌ Error: Debes proporcionar un dominio"
    echo "Uso: sudo bash scripts/setup_ssl.sh tudominio.com [email@example.com]"
    exit 1
fi

echo "=========================================="
echo "  CONFIGURACIÓN SSL/TLS - REP DRILL"
echo "=========================================="
echo "Dominio: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# 1. Instalar Certbot
echo "📦 Instalando Certbot..."
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
elif command -v yum &> /dev/null; then
    yum install -y certbot python3-certbot-nginx
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

# 2. Detener Nginx temporalmente
echo "⏸️  Deteniendo Nginx..."
systemctl stop nginx || docker-compose stop gateway

# 3. Obtener certificado
echo "🔐 Obteniendo certificado SSL de Let's Encrypt..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# 4. Configurar renovación automática
echo "🔄 Configurando renovación automática..."
cat > /etc/cron.d/certbot-renew << EOF
# Renovar certificados SSL cada día a las 3 AM
0 3 * * * root certbot renew --quiet --post-hook "systemctl reload nginx || docker-compose restart gateway"
EOF

# 5. Configurar Nginx
echo "⚙️  Configurando Nginx..."
cp nginx_ssl.conf /etc/nginx/sites-available/rep_drill_ssl
sed -i "s/tudominio.com/$DOMAIN/g" /etc/nginx/sites-available/rep_drill_ssl
ln -sf /etc/nginx/sites-available/rep_drill_ssl /etc/nginx/sites-enabled/

# 6. Test de configuración
echo "✅ Verificando configuración de Nginx..."
nginx -t

# 7. Reiniciar Nginx
echo "🚀 Reiniciando Nginx..."
systemctl start nginx || docker-compose start gateway
systemctl reload nginx || docker-compose restart gateway

echo ""
echo "=========================================="
echo "  ✅ SSL/TLS CONFIGURADO EXITOSAMENTE"
echo "=========================================="
echo "🔒 Tu sitio ahora está disponible en: https://$DOMAIN"
echo "📅 Los certificados se renovarán automáticamente"
echo "📊 Verifica el SSL en: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo "🔐 Certificados ubicados en:"
echo "   /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "   /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo ""
