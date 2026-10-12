import express from "express";
import { corsMiddleware } from "./middlewares/corsM.js";
import arbitroRouter from "./routes/arbitroR.js";
import authRouter from "./routes/authR.js";
import parametrosRouter from "./routes/parametrosR.js";
import usuariosRouter from "./routes/usuariosR.js";
import empleadoRouter from "./routes/empleadoR.js";
import disponibilidadRouter from "./routes/disponibilidadR.js";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { db } from "./config/db.js";

const PORT = process.env.PORT ?? process.env.DEFAULT_PORT;
const app = express();

// Middlewares
app.use(corsMiddleware());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Rutas
app.use("/api/arbitros", arbitroRouter);
app.use("/api/auth", authRouter);
app.use("/api/parametros", parametrosRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/empleados", empleadoRouter);
app.use("/api/disponibilidad", disponibilidadRouter);

// Salud del servicio. En Vercel no se sirven archivos estáticos desde Express:
// estas rutas responden JSON para que el navegador no reciba un error.
app.get(["/", "/api"], (req, res) => {
  res.status(200).json({ status: "ok", message: "API PITAR en funcionamiento" });
});

// Health check con verificación real de la base de datos: permite detectar
// errores de configuración de entorno (host, credenciales, red) en producción.
app.get("/api/health", async (req, res) => {
  try {
    await db.pitar.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "ok" });
  } catch (error) {
    console.error("Health check: base de datos no disponible:", error.message);
    res.status(200).json({ status: "degraded", db: "error" });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

// Servidor
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`La API se está ejecutando en http://localhost:${PORT}`);
  });
}

export default app;