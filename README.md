# Las Dos Doncellas — Tienda online + CMS

Web e-commerce premium para productos ibéricos artesanos de **Castilblanco de los Arroyos** (Sierra Norte de Sevilla).

**Stack:** FastAPI + MongoDB + React 19 + Stripe + Brevo + Gemini Nano Banana.

## Estructura

```
backend/    — FastAPI (Python 3.11+), uvicorn, motor (MongoDB async)
frontend/   — React 19, react-router 7, Tailwind, Shadcn UI, sonner
DEPLOY_GUIDE.md — guía paso a paso para desplegar en Render + LucusHost
```

## Desarrollo local

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env .env.local        # ajusta MONGO_URL y demás
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start
```

## CMS

URL admin: `/admin/login` · Superadmin: ver `memory/test_credentials.md`.

Cinco pestañas: Dashboard, Productos, Pedidos, Proveedores, Usuarios — todas con **import/export Excel** (botones "Plantilla", "Exportar", "Importar").

## Despliegue

Ver `DEPLOY_GUIDE.md`.
