# 🚀 Guía de despliegue — Las Dos Doncellas

Dominio: **lasdosdoncellasibericos.es** (LucusHost)
Stack: **FastAPI (Python) + React + MongoDB**

---

## 🎯 Arquitectura recomendada (gratis o muy bajo coste)

```
                ┌─────────────────────────────────┐
                │   lasdosdoncellasibericos.es    │
                │   (LucusHost · solo frontend)   │
                │   • build estático (React)      │
                │   • sitemap.xml, robots.txt     │
                └────────────┬────────────────────┘
                             │
                             │  HTTPS /api/* → backend
                             ▼
                ┌─────────────────────────────────┐
                │  api.lasdosdoncellasibericos.es │
                │  o servicio en Render.com       │
                │  (FastAPI + Uvicorn)            │
                └────────────┬────────────────────┘
                             │
                             ▼
                ┌─────────────────────────────────┐
                │  MongoDB Atlas (gratis 512MB)   │
                │  mongodb+srv://...              │
                └─────────────────────────────────┘
```

---

## PASO 1 · MongoDB Atlas (gratis)

1. Entra en https://www.mongodb.com/cloud/atlas/register y crea cuenta.
2. Crea un cluster **M0 Free** (región: Europa, Frankfurt o Madrid).
3. En **Database Access**, crea un usuario con password fuerte (anótalo).
4. En **Network Access**, añade `0.0.0.0/0` (acceso desde cualquier IP — Render IPs son dinámicas).
5. En **Database → Connect → Drivers**, copia la URI tipo:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   mongodb+srv://antokastil_db_user:Lucas2022@whitecastle-db.cofhtoz.mongodb.net/?appName=whitecastle-db
   ```
6. Guarda esta URI: la usaremos como `MONGO_URL` en Render.

---

## PASO 2 · Backend en Render.com

Ya tienes cuenta y dos servicios funcionando, así que añadir el tercero es directo.

### 2.1 — Sube el código a un repo GitHub
1. Crea repo nuevo: `lasdosdoncellas-app`.
2. Sube el contenido descomprimido del ZIP que te genero.

### 2.2 — Crea Web Service en Render

1. **New +** → **Web Service** → conecta el repo de GitHub.
2. Configuración:
   - **Name**: `lasdosdoncellas-api`
   - **Region**: Frankfurt (o la más cercana)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```
     uvicorn server:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: `Free` (sube a `Starter` si quieres SSL en custom domain sin pausa por inactividad)

3. **Environment Variables** (Add Environment Variable):
   ```
   MONGO_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=lasdosdoncellas
   CORS_ORIGINS=https://lasdosdoncellasibericos.es,https://www.lasdosdoncellasibericos.es
   JWT_SECRET=hNHNImyiF6LD•••orNAvsHFeZal
   ADMIN_EMAIL=admin@lasdosdoncellasibericos.es
   ADMIN_PASSWORD=<contraseña fuerte que cumpla rules> LDD2026*-
   STRIPE_API_KEY=<tu clave LIVE de Stripe, NO la de test>
   EMERGENT_LLM_KEY=<tu clave de Emergent para IA imágenes (opcional)>
   BREVO_API_KEY=<tu key de brevo.com>
   BREVO_SENDER_EMAIL=pedidos@lasdosdoncellasibericos.es
   BREVO_SENDER_NAME=Las Dos Doncellas
   BREVO_ADMIN_EMAIL=pedidos@lasdosdoncellasibericos.es
   APP_NAME=lasdosdoncellas
   COMPANY_NAME=Las Dos Doncellas
   COMPANY_LEGAL_NAME=Las Dos Doncellas S.L.
   COMPANY_CIF=77815813M
   COMPANY_ADDRESS=Plaza Amarilla, 3
   COMPANY_POSTAL=41230
   COMPANY_CITY=Castilblanco de los Arroyos
   COMPANY_PROVINCE=Sevilla
   COMPANY_COUNTRY=España
   COMPANY_REGION=Sierra Norte de Sevilla
   COMPANY_EMAIL=pedidos@lasdosdoncellasibericos.es
   ```

4. **Create Web Service**. Espera 3-5 minutos al primer build.
5. Una vez deployed, Render te da una URL tipo `https://lasdosdoncellas-api.onrender.com`. Pruébala:
   ```
   curl https://lasdosdoncellas-api.onrender.com/api
   → {"status":"ok","name":"Las Dos Doncellas API"}
   ```

### 2.3 — Custom domain (opcional pero recomendado)

1. En Render → tu servicio → **Settings → Custom Domain** → añadir `api.lasdosdoncellasibericos.es`.
2. Render te dará un valor CNAME tipo `lasdosdoncellas-api.onrender.com`. hostname=api
3. En LucusHost panel DNS → crea registro **CNAME**:
   - Host: `api`
   - Apunta a: `lasdosdoncellas-api.onrender.com`
4. Espera ~10 min, Render generará SSL automáticamente.

---

## PASO 3 · Frontend estático en LucusHost

### 3.1 — Build local

```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://api.lasdosdoncellasibericos.es" > .env
yarn install
yarn build
```

Esto genera la carpeta `frontend/build/` con HTML/CSS/JS estáticos optimizados.

### 3.2 — Subir a LucusHost (vía cPanel o FTP)

1. Accede al **Administrador de archivos** o vía FTP/SFTP.
2. Sube TODO el contenido de `frontend/build/` a la carpeta raíz del dominio (`/public_html/` o `/www/`).
3. **Importante:** sube también `sitemap.xml` y `robots.txt` (ya están en `build/`).
4. Crea `.htaccess` en la raíz (porque React es SPA) con:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Servir sitemap y robots tal cual
  RewriteRule ^(sitemap\.xml|robots\.txt)$ - [L]
  # Archivos estáticos existentes
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  # Resto → index.html (SPA)
  RewriteRule . /index.html [L]
</IfModule>

# Forzar HTTPS
<IfModule mod_rewrite.c>
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# Cache largo en estáticos
<IfModule mod_headers.c>
  <FilesMatch "\.(jpg|jpeg|png|webp|svg|woff2|css|js)$">
    Header set Cache-Control "max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

5. Activa SSL en LucusHost (Let's Encrypt — gratis, 1 click).

---

## PASO 4 · Configurar Brevo (emails)

1. Cuenta en https://www.brevo.com (300 emails/día gratis).
2. **Senders & IPs** → añadir `pedidos@lasdosdoncellasibericos.es`.
3. Brevo te pide verificar dominio: añade los registros TXT/DKIM en LucusHost DNS.
4. Settings → SMTP & API → **Generate API key** → copia.
5. Pega en Render env var: `BREVO_API_KEY=xkeysib-xxxxx`.
6. Reinicia el servicio Render. Listo.

---

## PASO 5 · Stripe en modo LIVE

1. En https://dashboard.stripe.com → activa tu cuenta (KYC empresa).
2. **Developers → API keys** → copia la **Secret Key LIVE** (`sk_live_...`).
3. En Render: cambia `STRIPE_API_KEY` por la live.
4. **Developers → Webhooks**:
   - URL: `https://api.lasdosdoncellasibericos.es/api/webhook/stripe`
   - Eventos: `checkout.session.completed`, `checkout.session.expired`
   - Copia el `Signing secret` (lo necesitarás si añadimos verificación firmada).

---

## PASO 6 · Primer acceso al CMS

1. Abre `https://lasdosdoncellasibericos.es/admin/login`.
2. Email: el de `ADMIN_EMAIL` · Contraseña: la de `ADMIN_PASSWORD`.
3. **Cambia la contraseña inmediatamente** desde Usuarios → tu cuenta.
4. Sube tus productos con **Excel → Plantilla → Importar** o uno a uno.
5. Crea tus proveedores.
6. **Configura el sitemap en Google Search Console**: https://search.google.com/search-console → añade propiedad `lasdosdoncellasibericos.es` y envía `sitemap.xml`.

---

## ✅ Checklist final
- [ ] MongoDB Atlas cluster creado
- [ ] Backend desplegado en Render con env vars
- [ ] `api.lasdosdoncellasibericos.es` apuntando a Render (CNAME)
- [ ] Frontend `yarn build` y subido a LucusHost
- [ ] `.htaccess` configurado para SPA + HTTPS
- [ ] SSL activado en LucusHost
- [ ] Brevo configurado con dominio verificado
- [ ] Stripe en modo LIVE + webhook
- [ ] Contraseña del superadmin cambiada
- [ ] Sitemap enviado a Google Search Console

## 🐛 Troubleshooting
- **El frontend muestra "Cargando…" eternamente** → revisa la consola del navegador: si ves CORS errors, añade tu dominio a `CORS_ORIGINS` en Render y reinicia.
- **Render se duerme tras 15min** (plan Free) → primera request tarda ~30s. Sube a Starter (~7€/mes) para que esté siempre activo.
- **Brevo emails no llegan** → verifica que el dominio está marcado "Verified" en Brevo y los DKIM/SPF están añadidos en LucusHost DNS.
- **Stripe webhook falla** → revisa que la URL es exacta y empieza por `https://`.

## 📞 Soporte rápido
Si algo falla, revisa los logs en Render → Logs. Los más comunes:
- `KeyError: 'MONGO_URL'` → variable de entorno no añadida.
- `Connection refused` → MongoDB Atlas no permite tu IP (añade `0.0.0.0/0` en Network Access).
- `403 Forbidden` desde frontend → CORS mal configurado.
