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

  // Role CODES (ADM/GER/SUP/ARB/CNT) for a user, one row per role in the
  // v_usuarios_roles view. Used by the RBAC guard so role checks never depend on
  // the display-name string exposed by v_usuarios.roles.
  static async getRoleCodes(id) {
    const [rows] = await db.pitar.query(
      "SELECT codigo_rol FROM v_usuarios_roles WHERE id_usuario = ?",
      [id],
    );
    return rows.map((row) => row.codigo_rol);
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
    roles,
  ) {
    const pass =
      "." + nombres.slice(-1) + documento + apellidos.charAt(0) + ".";
    const pass_hash = await this.hashPassword(pass);

    // Compatibilidad hacia atrás: acepta un código único como string además
    // del array de roles. Se deduplican para no romper la PK de usuario_rol.
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const rolesUnicos = [...new Set(rolesArray.filter(Boolean))];

    // El SP no es transaccional: si el INSERT en usuario_rol falla (p. ej.
    // por un código de rol inexistente), el INSERT previo en usuarios quedaría
    // commiteado como fila huérfana. La transacción aquí garantiza que CALL,
    // la asignación de los roles restantes y SELECT @username se confirmen
    // juntos o se reviertan juntos.
    // Una transacción sobre pool requiere UNA sola conexión durante todo el
    // ciclo: query/execute del pool tomarían conexiones distintas y romperían
    // la transacción. getConnection() la reserva y release() la devuelve.
    const conn = await db.pitar.getConnection();
    try {
      await conn.beginTransaction();

      // Se usa una variable de sesión (@username) para capturar el OUT del SP,
      // ya que el procedimiento genera el username internamente.
      // p_nuevo_usuario crea el usuario y el empleado, y asigna el PRIMER rol.
      await conn.execute(
        "CALL p_nuevo_usuario(?, ?, ?, ?, ?, ?, ?, @username)",
        [
          nombres,
          apellidos,
          tipo_documento,
          documento,
          email,
          rolesUnicos[0],
          pass_hash,
        ],
      );

      const [rows] = await conn.query("SELECT @username AS username");
      const username = rows[0]?.username ?? null;

      // p_nuevo_usuario solo asigna un rol; el resto se inserta dentro de la
      // MISMA transacción con el mismo patrón que UsuarioModel.update.
      const rolesRestantes = rolesUnicos.slice(1);
      if (rolesRestantes.length > 0) {
        const [rolesRows] = await conn.query(
          "SELECT id FROM roles WHERE codigo IN (?)",
          [rolesRestantes],
        );
        if (rolesRows.length !== rolesRestantes.length) {
          throw new Error("Uno o más roles no existen");
        }
        const [usuarioRows] = await conn.query(
          "SELECT id FROM usuarios WHERE username = ?",
          [username],
        );
        const id_usuario = usuarioRows[0].id;
        const values = rolesRows.map((rol) => [id_usuario, rol.id]);
        await conn.query(
          "INSERT usuario_rol (id_usuario, id_rol) VALUES ?",
          [values],
        );
      }

      await conn.commit();

      // temporaryPassword viaja solo para el envío del correo; el controlador
      // no debe exponerla en la respuesta al cliente.
      return {
        message: "Usuario creado exitosamente",
        username,
        email,
        temporaryPassword: pass,
      };
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
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

  // Recuperación de contraseña: localiza el usuario por username O email.
  // El flujo de forgot/reset no debe diferenciar entre identificadores válidos
  // e inválidos para evitar enumeración de cuentas.
  static async findByIdentifier(identifier) {
    const [rows] = await db.pitar.query(
      "SELECT id, username, email, activo FROM usuarios WHERE username = ? OR email = ? LIMIT 1",
      [identifier, identifier],
    );
    return rows[0];
  }

  // Guarda SOLO el hash SHA-256 del token de reset (nunca el token en claro)
  // junto con su expiración.
  static async setResetToken(userId, tokenHash, expira) {
    await db.pitar.execute(
      "UPDATE usuarios SET reset_token_hash = ?, reset_token_expira = ? WHERE id = ?",
      [tokenHash, expira, userId],
    );
    return { message: "Token de recuperación almacenado" };
  }

  // Busca por hash de token. Incluye la expiración para que el controlador
  // pueda distinguir entre token inválido y token vencido.
  static async findUserByResetToken(tokenHash) {
    const [rows] = await db.pitar.query(
      "SELECT id, username, email, reset_token_expira FROM usuarios WHERE reset_token_hash = ?",
      [tokenHash],
    );
    return rows[0];
  }

  // Efectúa el reset: nuevo pass_hash (el trigger t_bu_usuarios actualiza
  // pass_fecha_cambio automáticamente) y limpia el token para que sea de un
  // solo uso.
  static async resetPassword(userId, newPassword) {
    const hashedPassword = await this.hashPassword(newPassword);
    await db.pitar.execute(
      "UPDATE usuarios SET pass_hash = ?, reset_token_hash = NULL, reset_token_expira = NULL WHERE id = ?",
      [hashedPassword, userId],
    );
    return { message: "Contraseña restablecida exitosamente" };
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
