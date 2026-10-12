import mysql from "mysql2/promise";
import "dotenv/config"; // Carga las variables de entorno automáticamente

// Pools lazy para serverless (Vercel).
//
// En un entorno serverless cada instancia de la función es efímera, así que NO
// se abre ninguna conexión al importar el módulo: el pool crea conexiones bajo
// demanda en la primera consulta y las reutiliza mientras la instancia siga
// viva. `connectionLimit` pequeño evita agotar la base de datos cuando varias
// instancias reciben ráfagas de peticiones al mismo tiempo.
const POOL_OPTIONS = {
  connectionLimit: 5,
  waitForConnections: true,
  connectTimeout: 10_000, // 10 s: evita colgar el cold start frente a un host caído
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const createPool = (env) =>
  mysql.createPool({
    ...POOL_OPTIONS,
    host: env.HOST,
    user: env.USER,
    password: env.PASSWORD,
    database: env.NAME,
  });

// Exportar pools para cada base de datos. Los host deben ser alcanzables desde
// Vercel por red pública (nada de localhost / IP privada).
export const db = {
  // Base de datos Pitar: usada por la mayoría de los endpoints.
  pitar: createPool({
    HOST: process.env.DB_PITAR_HOST,
    USER: process.env.DB_PITAR_USER,
    PASSWORD: process.env.DB_PITAR_PASSWORD,
    NAME: process.env.DB_PITAR_NAME,
  }),

  // Base de datos Siscamp (reservada; sin conexión hasta que se use).
  siscamp: createPool({
    HOST: process.env.DB_SISCAMP_HOST,
    USER: process.env.DB_SISCAMP_USER,
    PASSWORD: process.env.DB_SISCAMP_PASSWORD,
    NAME: process.env.DB_SISCAMP_NAME,
  }),
};