import { UsuarioModel } from "../models/usuario.js";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { sendResetPasswordEmail } from "../config/mail.js";

// Limitador en memoria para el envío de enlaces de recuperación: una petición
// por identificador y por IP cada 60 segundos. Suficiente para un proceso
// único (dev/producción pequeña); con múltiples instancias debería migrar a
// un almacén compartido.
const FORGOT_COOLDOWN_MS = 60_000;
const forgotCooldowns = new Map();

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export class AuthController {
  static login = async (req, res) => {
    try {
      const { username, password } = req.body;
      // Validaciones básicas
      if (!username || !password) {
        return res
          .status(400)
          .json({ message: "Usuario y contraseña son requeridos" });
      }

      // Buscar usuario por username
      const user = await UsuarioModel.getUserCredentials(username);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }
      // Verificar contraseña
      const isPasswordValid = await UsuarioModel.verifyPassword(
        password,
        user.pass_hash,
      );
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Generar JWT
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      const isProd = process.env.NODE_ENV === "production";
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        maxAge: 60 * 60 * 1000,
      });

      // Actualizar última conexión
      await UsuarioModel.updateLastConnection(user.id);

      // Indicar cambio obligatorio de contraseña si nunca se ha cambiado
      const mustChangePassword = !user.pass_fecha_cambio;

      // Obtener datos completos del usuario para el frontend
      const userData = await UsuarioModel.getById(user.id);
      res
        .status(200)
        .json({ message: "Login exitoso", token, mustChangePassword, user: userData || user });
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static logout = async (req, res) => {
    res.clearCookie("authToken");
    res.status(200).json({ message: "Logout exitoso" });
  };

  static verify = async (req, res) => {
    try {
      const cookieToken = req.cookies.authToken;
      const headerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;
      const token = cookieToken || headerToken;
      if (!token)
        return res
          .status(401)
          .json({ authenticated: false, message: "Token no encontrado" });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const user = await UsuarioModel.getById(userId);
      if (!user) {
        return res
          .status(401)
          .json({ authenticated: false, message: "Usuario no encontrado" });
      }

      if (user.activo !== 1) {
        return res
          .status(401)
          .json({ authenticated: false, message: "Usuario no activo" });
      }

      req.user = user;

      // Obtener credenciales para determinar si debe cambiar la contraseña
      const credentials = await UsuarioModel.getUserCredentialsById(userId);
      const mustChangePassword = !credentials?.pass_fecha_cambio;

      return res
        .status(200)
        .json({ authenticated: true, mustChangePassword, user });
    } catch (error) {
      console.error("AuthController.verify error:", error);
      res.status(401).json({ authenticated: false, message: "Token inválido" });
    }
  };

  static getUserInfo = async (req, res) => {
    try {
      const user = req.user;
      res.status(200).json({ user });
    } catch (error) {
      console.error("AuthController.getUserInfo error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // Solicitud de recuperación de contraseña. La respuesta es genérica tanto si
  // el identificador existe como si no, para no revelar qué cuentas están
  // registradas. Solo se persiste el hash SHA-256 del token.
  static forgotPassword = async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier || !identifier.trim()) {
        return res
          .status(400)
          .json({ message: "Usuario o correo es requerido" });
      }

      const key = `${req.ip}|${identifier.trim().toLowerCase()}`;
      const lastAttempt = forgotCooldowns.get(key) ?? 0;
      if (Date.now() - lastAttempt < FORGOT_COOLDOWN_MS) {
        return res
          .status(429)
          .json({ message: "Demasiados intentos. Espera un minuto." });
      }
      forgotCooldowns.set(key, Date.now());

      // Limpieza puntual del map para evitar crecimiento sin límite.
      if (forgotCooldowns.size > 1_000) {
        const now = Date.now();
        for (const [k, ts] of forgotCooldowns) {
          if (now - ts > FORGOT_COOLDOWN_MS) forgotCooldowns.delete(k);
        }
      }

      const user = await UsuarioModel.findByIdentifier(identifier.trim());
      if (user && user.activo === 1 && user.email) {
        const token = crypto.randomBytes(32).toString("hex");
        const expira = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
        await UsuarioModel.setResetToken(user.id, sha256(token), expira);

        const appUrl = process.env.APP_URL || "http://localhost:5173";
        const link = `${appUrl}/reset-password?token=${token}`;
        // Nunca lanza: un fallo de SMTP no debe revelar si la cuenta existe.
        await sendResetPasswordEmail({
          to: user.email,
          username: user.username,
          link,
        });
      }

      return res.status(200).json({
        message:
          "Si el usuario existe y tiene un correo asociado, recibirás un enlace para restablecer tu contraseña.",
      });
    } catch (error) {
      console.error("AuthController.forgotPassword error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // Consumo del enlace de recuperación: valida el hash del token, la
  // expiración y aplica la nueva contraseña. El token se limpia al usarlo,
  // por lo que reintentar el mismo enlace falla (un solo uso).
  static resetPassword = async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !token.trim()) {
        return res
          .status(400)
          .json({ message: "El enlace de recuperación es requerido" });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({
          message: "La contraseña debe tener al menos 6 caracteres",
        });
      }

      const user = await UsuarioModel.findUserByResetToken(sha256(token.trim()));
      if (!user) {
        return res.status(400).json({
          message: "El enlace es inválido o ya fue utilizado",
        });
      }

      if (new Date(user.reset_token_expira).getTime() < Date.now()) {
        // Limpia el token vencido para que quede como nunca existió.
        await UsuarioModel.setResetToken(user.id, null, null);
        return res.status(400).json({
          message: "El enlace ha expirado. Solicita uno nuevo.",
        });
      }

      await UsuarioModel.resetPassword(user.id, password);
      return res
        .status(200)
        .json({ message: "Contraseña restablecida exitosamente" });
    } catch (error) {
      console.error("AuthController.resetPassword error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
