import mysql from "mysql2";
import "dotenv/config"; // Carga las variables de entorno automáticamente

// Configuración de múltiples conexiones
const connections = {
  // Base de datos Pitar
  pitar: mysql.createConnection({
    host: process.env.DB_PITAR_HOST,
    user: process.env.DB_PITAR_USER,
    password: process.env.DB_PITAR_PASSWORD,
    database: process.env.DB_PITAR_NAME,
  }),

  // Base de datos Siscamp
  siscamp: mysql.createConnection({
    host: process.env.DB_SISCAMP_HOST,
    user: process.env.DB_SISCAMP_USER,
    password: process.env.DB_SISCAMP_PASSWORD,
    database: process.env.DB_SISCAMP_NAME,
  }),
};

// Conexión todas las bases de datos
const connectAllDatabases = async () => {
  for (const [name, connection] of Object.entries(connections)) {
    try {
      await new Promise((resolve, reject) => {
        connection.connect((err) => {
          if (err) {
            console.error(`Error conectando a la base de datos ${name}:`, err);
            reject(err);
          } else {
            console.log(`Conectado a la base de datos: ${name}`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(
        `No se pudo conectar a ${name}, continuando con otras bases de datos...`,
      );
    }
  }
};

// Conectar a todas las bases de datos al iniciar
connectAllDatabases();

// Exportar objeto con todas las conexiones
export const db = {
  pitar: connections.pitar.promise(),
  siscamp: connections.siscamp.promise(),
};
