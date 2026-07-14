# Test Credentials — Las Dos Doncellas

## Super Administrador (no se puede eliminar)
- Email: `admin@lasdosdoncellas.com`
- Password: `Admin1234`
- Rol: `superadmin`
- Permisos: TODOS (incluye `stock.read/write/approve` para Fase 4 — alertas de stock y aprobación de proformas a proveedores; `customers.read/write/delete` también gestiona Usuarios Empresa B2B).

## Cliente de prueba (storefront)
- Email: `testcustomer1782304632@example.com`
- Password: `Password1`
- Verificado manualmente vía MongoDB.
- Para registrar un cliente nuevo desde la UI:
  1. POST /api/auth/register (first_name, last_name, email, password)
  2. Actualizar `is_verified=true` en `db.users` o pulsar el enlace de verificación enviado por correo (Resend).
  3. POST /api/auth/login con esas credenciales.

## Endpoints clave
- POST /api/auth/login       (admin + cliente, sistema unificado en db.users)
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/register    (registro de cliente)
- GET  /api/customer/me      (acepta token unificado type=access — devuelve cliente con name normalizado)
- POST /api/customer/addresses
- GET/POST/PATCH/DELETE /api/users
- GET/POST/PATCH/DELETE /api/products
- POST /api/products/{id}/images  (multipart, AI enhance)
- GET/POST /api/categories
- POST /api/checkout/session
- GET  /api/checkout/status/{session_id}
- POST /api/webhook/stripe
- GET  /api/orders, /api/orders/{id}, PATCH /api/orders/{id}/status
- GET  /api/orders/{id}/invoice  (PDF)
- GET  /api/dashboard
- GET  /api/reviews/recent?limit&min_rating  (público, usado en el home)

## Notas
- Auth via httpOnly cookie `access_token` (también se devuelve en el body de login para uso del frontend).
- Reglas de contraseña: mínimo 8, mayúscula, minúscula y número.
- Frontend: el CMS guarda token en `localStorage.ldd_token`; el storefront en `localStorage.ldd_customer_token`.
- El contexto del cliente usa `withCredentials:false` para evitar que las cookies del admin se filtren al storefront.
