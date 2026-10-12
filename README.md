# PITAR API

API REST del proyecto PITAR (Express 5 · ESM · MySQL · JWT).

## Requisitos

- Node.js 20 o superior
- Acceso a las bases de datos `pitar` y `siscamp` (MySQL)

## Instalación local

```bash
npm install
cp .env.example .env   # completa las variables
npm run dev
```

La API escucha en `http://localhost:${PORT}` (o `DEFAULT_PORT`).

## Variables de entorno

Todas las variables viven en `.env` (local) y en **Vercel → Settings →
Environment Variables** (producción). Ver `.env.example` para la lista completa:

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `production` en Vercel (Vercel lo define solo) |
| `PORT` / `DEFAULT_PORT` | Puerto de escucha en desarrollo |
| `DB_PITAR_*` / `DB_SISCAMP_*` | Conexión MySQL (`HOST`, `USER`, `PASSWORD`, `NAME`) |
| `JWT_SECRET` | Firma y verificación de los tokens JWT |
| `ALLOWED_ORIGINS` | Orígenes permitidos por CORS, separados por coma (los del frontend) |
| `APP_URL` | URL del frontend, usada en el enlace de recuperación de contraseña |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` | SMTP para los correos de bienvenida y de recuperación |

## Despliegue en Vercel

El proyecto usa la **detección automática de Express** de Vercel: `app.js`
exporta la aplicación con `export default app`, así que **no requiere un
`vercel.json`**.

1. Importa el repositorio en Vercel (Framework Preset: **Other / Node.js**).
2. Configura **todas** las variables de entorno del cuadro anterior.
3. Despliega. Cada push a `main` genera un nuevo despliegue.

Consideraciones del entorno serverless:

- **Base de datos**: los hosts de MySQL deben ser alcanzables por red pública
  desde Vercel (nada de `localhost` ni IP privada). Las conexiones usan pools
  (`config/db.js`) pensados para instancias efímeras.
- **Anexos**: los PDF se guardan como `MEDIUMBLOB` en la base (sin escrituras a
  disco). El tamaño máximo por archivo es **1 MB**.
- **Archivos estáticos**: Vercel no sirve estáticos desde Express. La raíz (`/`)
  y `/api` responden JSON.

## Autenticación

`POST /api/auth/login` devuelve un `token` JWT en el cuerpo. El cliente debe
enviarlo en cada petición:

```
Authorization: Bearer <token>
```

El `AuthMiddleware` acepta también la cookie `authToken`, pero esa cookie se
emite con `SameSite=strict` y por tanto **no viaja entre dominios distintos**:
si el frontend y la API están en dominios diferentes, usa siempre el header
`Authorization`.

## Endpoints de salud

- `GET /` y `GET /api` → `{ "status": "ok" }`
- `GET /api/health` → `{ "status": "ok", "db": "ok" }` (o `db: "error"` si la
  base de datos no responde)
