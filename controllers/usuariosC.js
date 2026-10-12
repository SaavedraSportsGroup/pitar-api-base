import { UsuarioModel } from "../models/usuario.js";
import { sendWelcomeEmail } from "../config/mail.js";

export class UsuarioController {
  static ROLES_VALIDOS = ["ADM", "GER", "SUP", "ARB", "CNT"];

  static getAll = async (req, res) => {
    try {
      // Extraer el término de búsqueda
      const { q } = req.query;

      const usuarios = await UsuarioModel.getAll(q);

      if (!usuarios) {
        return res.status(500).json({
          message: "Error al obtener usuarios",
        });
      }

      return res.json({
        data: usuarios,
        search: q,
        total: usuarios.length,
      });
    } catch (error) {
      console.log("Error al obtener usuarios.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getById = async (req, res) => {
    try {
      const { id } = req.params;

      const usuario = await UsuarioModel.getById(id);

      if (!usuario)
        return res.status(404).json({ message: "Usuario no encontrado" });

      return res.json(usuario);
    } catch (error) {
      console.log("Error al obtener usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getByUser = async (req, res) => {
    try {
      const { username } = req.params;

      const usuario = await UsuarioModel.getByUser(username);

      if (!usuario)
        return res.status(404).json({ message: "Usuario no encontrado" });

      return res.json(usuario);
    } catch (error) {
      console.log("Error al obtener usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static create = async (req, res) => {
    try {
      const { nombres, apellidos, documento, email, roles, rol } = req.body;
      // El formulario envía `tipoDocumento` (camelCase); se acepta también la
      // clave snake_case por compatibilidad con clientes anteriores.
      const tipo_documento = req.body.tipo_documento ?? req.body.tipoDocumento;
      // El formulario envía `roles` (array). Se acepta también el `rol` único
      // heredado por compatibilidad hacia atrás.
      const rolesSolicitados = Array.isArray(roles) ? roles : rol ? [rol] : [];

      // Se validan TODOS los códigos antes de tocar la BD: con un código
      // inexistente el SP fallaría a mitad de ejecución y dejaría un usuario
      // sin rol. Se deduplican para no romper la PK de usuario_rol.
      const rolesUnicos = [...new Set(rolesSolicitados.filter(Boolean))];
      const rolesValidos =
        rolesUnicos.length > 0 &&
        rolesUnicos.every((codigo) =>
          UsuarioController.ROLES_VALIDOS.includes(codigo),
        );
      if (!rolesValidos) {
        return res.status(400).json({
          message: "Rol inválido. Valores permitidos: ADM, GER, SUP, ARB, CNT",
        });
      }

      const newUsuario = await UsuarioModel.create(
        nombres,
        apellidos,
        tipo_documento,
        documento,
        email,
        rolesUnicos,
      );

      if (!newUsuario)
        return res.status(204).json({ error: "Usuario no creado" });

      // Enviar el correo de bienvenida con las credenciales solo si se generó
      // el username y hay email. sendWelcomeEmail nunca propaga errores, así
      // que un fallo de SMTP no interrumpe la creación del usuario.
      if (newUsuario.username && newUsuario.email) {
        await sendWelcomeEmail({
          to: newUsuario.email,
          username: newUsuario.username,
          password: newUsuario.temporaryPassword,
        });
      }

      // La contraseña temporal es exclusiva del correo; no se expone al cliente.
      return res.json({
        message: newUsuario.message,
        username: newUsuario.username,
      });
    } catch (error) {
      console.log("Error al crear usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static update = async (req, res) => {
    try {
      const { id } = req.params;
      const { email, activo, roles } = req.body;
      const updatedUsuario = await UsuarioModel.update(
        id,
        email,
        activo,
        roles,
      );

      if (!updatedUsuario)
        return res.status(204).json({ error: "Usuario no actualizado" });

      return res.json(updatedUsuario);
    } catch (error) {
      console.log("Error al actualizar usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static updatePass = async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const user = await UsuarioModel.getUserCredentialsById(id);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      const isPasswordValid = !(await UsuarioModel.verifyPassword(
        password,
        user.pass_hash,
      ));
      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ message: "La nueva contraseña es la misma que la anterior" });
      }

      const updatedUsuario = await UsuarioModel.updatePass(id, password);

      if (!updatedUsuario)
        return res.status(204).json({ error: "Contraseña no actualizada" });

      return res.json(updatedUsuario);
    } catch (error) {
      console.log("Error al actualizar la contraseña.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static delete = async (req, res) => {
    try {
      const { id } = req.params;

      const deletedUsuario = await UsuarioModel.delete(id);

      if (!deletedUsuario)
        return res.status(204).json({ error: "Usuario no eliminado" });

      return res.json(deletedUsuario);
    } catch (error) {
      console.log("Error al eliminar usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
