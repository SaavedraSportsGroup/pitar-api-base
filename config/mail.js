import nodemailer from "nodemailer";
import "dotenv/config"; // Carga las variables de entorno si el módulo se importa por separado

// Lee la configuración SMTP del entorno. Las credenciales quedan vacías por
// defecto para que la API funcione aunque el correo todavía no esté configurado.
const getMailConfig = () => {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const port = Number(process.env.MAIL_PORT) || 587;
  const secure = process.env.MAIL_SECURE === "true";
  // Si MAIL_FROM no está definido, se usa MAIL_USER como remitente.
  const from = process.env.MAIL_FROM || user;

  return { host, port, secure, user, pass, from };
};

// Crea el transporter de nodemailer. Solo se invoca cuando hay credenciales.
const createTransporter = (config) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

// Envía el correo de bienvenida con las credenciales temporales.
// Nunca lanza: si el SMTP no está configurado o falla el envío, solo se registra
// en consola para no interrumpir la creación del usuario.
export const sendWelcomeEmail = async ({ to, username, password }) => {
  const config = getMailConfig();

  // Sin host ni usuario no es posible enviar: se advierte y se continúa.
  if (!config.host || !config.user) {
    console.warn("SMTP no configurado: no se envió el correo a " + to);
    return null;
  }

  try {
    const transporter = createTransporter(config);

    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject: "Bienvenido a PITAR – Credenciales de acceso",
      html: `
        <p>Hola ${username},</p>
        <p>Tu cuenta en PITAR ha sido creada correctamente.</p>
        <p>
          <strong>Usuario:</strong> ${username}<br />
          <strong>Contraseña temporal:</strong> ${password}
        </p>
        <p>
          Por seguridad, debes cambiar la contraseña en tu primer ingreso
          al sistema.
        </p>
        <p>Saludos,<br />Equipo PITAR</p>
      `,
    });

    return info;
  } catch (error) {
    // No se propaga: la creación del usuario ya se completó correctamente.
    console.error(
      `Error al enviar el correo de bienvenida a ${to}:`,
      error.message,
    );
    return null;
  }
};

// Envía el correo de recuperación de contraseña con el enlace de un solo uso.
// Mismo contrato que sendWelcomeEmail: nunca lanza, solo registra en consola
// si el SMTP no está configurado o falla el envío.
export const sendResetPasswordEmail = async ({ to, username, link }) => {
  const config = getMailConfig();

  if (!config.host || !config.user) {
    console.warn("SMTP no configurado: no se envió el correo de reset a " + to);
    return null;
  }

  try {
    const transporter = createTransporter(config);

    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject: "PITAR – Restablecer contraseña",
      html: `
        <p>Hola ${username},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>
          Abre el siguiente enlace para crear una nueva contraseña.
          El enlace es válido por 30 minutos y solo puede usarse una vez:
        </p>
        <p><a href="${link}">${link}</a></p>
        <p>
          Si no solicitaste este cambio, ignora este correo y tu contraseña
          seguirá siendo la misma.
        </p>
        <p>Saludos,<br />Equipo PITAR</p>
      `,
    });

    return info;
  } catch (error) {
    // No se propaga: la respuesta al cliente es genérica de todos modos.
    console.error(
      `Error al enviar el correo de reset a ${to}:`,
      error.message,
    );
    return null;
  }
};
