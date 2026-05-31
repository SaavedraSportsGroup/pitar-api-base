import { UsuarioModel } from "../models/usuario.js";

export class UsuarioController {
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
      const { nombres, apellidos, tipo_documento, documento, email, rol } =
        req.body;
      const newUsuario = await UsuarioModel.create(
        nombres,
        apellidos,
        tipo_documento,
        documento,
        email,
        rol,
      );

      if (!newUsuario)
        return res.status(204).json({ error: "Usuario no creado" });

      return res.json(newUsuario);
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
      const { newPassword } = req.body;
      const user = await UsuarioModel.getUserCredentialsById(id);
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      const isPasswordValid = !(await UsuarioModel.verifyPassword(
        newPassword,
        user.pass_hash,
      ));
      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ message: "La nueva contraseña es la misma que la anterior" });
      }

      const updatedUsuario = await UsuarioModel.updatePass(id, newPassword);

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
