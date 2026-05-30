import { db } from "../config/db.js";
import bcrypt from "bcryptjs";

export class UsuarioModel {
  static async getAll(q = "") {
    let query = "SELECT * FROM v_usuarios";
    const queryParams = [];

    // Si hay un término de búsqueda, agregar condiciones WHERE
    if (q && q.trim() !== "") {
      const searchTerm = `%${q.trim()}%`;
      query += ` WHERE username LIKE ? OR email LIKE ? OR nombre LIKE ?`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await db.pitar.query(query, queryParams);
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.pitar.query(
      "SELECT * FROM v_usuarios WHERE id = ?",
      [id],
    );
    return rows[0];
  }

  static async getByUser(username) {
    const [rows] = await db.pitar.query(
      "SELECT * FROM v_usuarios WHERE username = ?",
      [username],
    );
    return rows[0];
  }

  static async getUserCredentials(username) {
    const [rows] = await db.pitar.query(
      "SELECT * FROM usuarios WHERE username = ?",
      [username],
    );
    return rows[0];
  }

  static async getUserCredentialsById(id) {
    const [rows] = await db.pitar.query("SELECT * FROM usuarios WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }

  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  static async create(
    nombres,
    apellidos,
    tipo_documento,
    documento,
    email,
    rol,
  ) {
    const pass =
      "." + nombres.slice(-1) + documento + apellidos.charAt(0) + ".";
    const pass_hash = await this.hashPassword(pass);

    const [rows] = await db.pitar.execute(
      "CALL p_nuevo_usuario(?, ?, ?, ?, ?, ?, ?, ?)",
      [
        nombres,
        apellidos,
        tipo_documento,
        documento,
        email,
        rol,
        pass_hash,
        null,
      ],
    );

    return { message: "Usuario creado exitosamente", rows };
  }

  static async update(id, email, activo, roles) {
    await db.pitar.execute(
      "UPDATE usuarios SET email = ?, activo = ? WHERE id = ?",
      [email, activo, id],
    );
    await db.pitar.execute("DELETE FROM usuario_rol WHERE id_usuario = ?", [
      id,
    ]);
    const rolesList = await db.pitar.query(
      "SELECT id FROM roles WHERE codigo IN (?)",
      [roles],
    );
    if (rolesList.length > 0) {
      const usuarioRolValues = rolesList[0].map((rol) => [
        parseInt(id),
        rol.id,
      ]);
      await db.pitar.query("INSERT usuario_rol (id_usuario, id_rol) VALUES ?", [
        usuarioRolValues,
      ]);
    }

    return { message: "Usuario actualizado exitosamente" };
  }

  static async updatePass(id, newPassword) {
    const hashedPassword = await this.hashPassword(newPassword);
    await db.pitar.execute("UPDATE usuarios SET pass_hash = ? WHERE id = ?", [
      hashedPassword,
      id,
    ]);
    return { message: "Contraseña actualizada exitosamente" };
  }

  static async updateLastConnection(id) {
    await db.pitar.execute(
      "UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?",
      [id],
    );
    return { message: "Última conexión actualizada exitosamente" };
  }

  static async delete(id) {
    const [rows] = await db.pitar.execute("DELETE FROM usuarios WHERE id = ?", [
      id,
    ]);
    return { message: "Usuario eliminado exitosamente", rows };
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}
