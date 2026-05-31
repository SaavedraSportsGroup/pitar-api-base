import express from "express";
import { corsMiddleware } from "./middlewares/corsM.js";
import authRouter from "./routes/authR.js";
import parametrosRouter from "./routes/parametrosR.js";
import usuariosRouter from "./routes/usuariosR.js";
import empleadoRouter from "./routes/empleadoR.js";
import "dotenv/config";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT ?? process.env.DEFAULT_PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(corsMiddleware());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Rutas
app.use("/api/auth", authRouter);
app.use("/api/parametros", parametrosRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/empleados", empleadoRouter);

app.get("/", (req, res) => {
  res.status(200).sendFile(path.join(__dirname, "index.html"));
});

app.get("/api", (req, res) => {
  res.status(200).sendFile(path.join(__dirname, "index.html"));
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
