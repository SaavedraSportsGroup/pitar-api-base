import { db } from "../config/db.js";

// Column allow-list for the dynamic UPDATE, mirroring `models/empleado.js`.
// `id`, `id_empleado` and `fecha_creacion` are intentionally excluded: the row
// owner and its creation timestamp never change.
const CAMPOS_ACTUALIZABLES = ["fecha", "hora_inicio", "hora_fin", "estado"];

// DATE/TIME are projected as strings (DATE_FORMAT/TIME_FORMAT) so the JSON
// payload is a stable `YYYY-MM-DD` / `HH:MM:SS` instead of a JS Date that could
// shift day across timezones. Column aliases keep the original field names.
const BASE_SELECT = `
  SELECT
      id
  ,   id_empleado
  ,   DATE_FORMAT(fecha, '%Y-%m-%d')       AS fecha
  ,   TIME_FORMAT(hora_inicio, '%H:%i:%s') AS hora_inicio
  ,   TIME_FORMAT(hora_fin, '%H:%i:%s')    AS hora_fin
  ,   estado
  ,   fecha_creacion
  FROM arbitros_disponibilidad
`;

export class DisponibilidadModel {
  // Franjas of one employee, optionally narrowed to a single day or a range.
  // Always ordered by start time so consumers get a stable timeline.
  static async getByEmpleado({ idEmpleado, fecha, desde, hasta }) {
    const where = ["id_empleado = ?"];
    const params = [idEmpleado];

    if (fecha) {
      where.push("fecha = ?");
      params.push(fecha);
    }
    if (desde && hasta) {
      where.push("fecha BETWEEN ? AND ?");
      params.push(desde, hasta);
    }

    const [rows] = await db.pitar.query(
      `${BASE_SELECT} WHERE ${where.join(" AND ")} ORDER BY hora_inicio ASC`,
      params,
    );
    return rows;
  }

  // One availability row by its own id (or undefined).
  static async getById(id) {
    const [rows] = await db.pitar.query(`${BASE_SELECT} WHERE id = ?`, [id]);
    return rows[0];
  }

  // Half-open interval overlap for the SAME (id_empleado, fecha):
  //   existing.hora_inicio < new.hora_fin AND existing.hora_fin > new.hora_inicio
  // Adjacent slots (one ends exactly when the next starts) do NOT overlap.
  // `excludeId` skips the row being edited so an update does not collide with
  // itself.
  static async existsOverlap({
    idEmpleado,
    fecha,
    horaInicio,
    horaFin,
    excludeId,
  }) {
    const where = [
      "id_empleado = ?",
      "fecha = ?",
      "hora_inicio < ?",
      "hora_fin > ?",
    ];
    const params = [idEmpleado, fecha, horaFin, horaInicio];

    if (excludeId != null) {
      where.push("id <> ?");
      params.push(excludeId);
    }

    const [rows] = await db.pitar.query(
      `SELECT 1 FROM arbitros_disponibilidad WHERE ${where.join(" AND ")} LIMIT 1`,
      params,
    );
    return rows.length > 0;
  }

  // Does the owning employee exist?
  static async empleadoExists(id) {
    const [rows] = await db.pitar.query(
      "SELECT 1 FROM empleados WHERE id = ? LIMIT 1",
      [id],
    );
    return rows.length > 0;
  }

  // `estado` defaults to 'DISPONIBLE' (same default as the DB column) when the
  // caller omits it. We re-read by insertId so the response always carries the
  // persisted row (generated id + fecha_creacion included).
  static async create({ idEmpleado, fecha, horaInicio, horaFin, estado }) {
    const [result] = await db.pitar.execute(
      `INSERT INTO arbitros_disponibilidad
         (id_empleado, fecha, hora_inicio, hora_fin, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [idEmpleado, fecha, horaInicio, horaFin, estado ?? "DISPONIBLE"],
    );
    return this.getById(result.insertId);
  }

  // Dynamic UPDATE over the allow-list. Returns the updated row, or
  // `{ affectedRows: 0 }` when no updatable field was provided.
  static async update(id, fields) {
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(fields).filter(([key]) =>
        CAMPOS_ACTUALIZABLES.includes(key),
      ),
    );

    if (Object.keys(fieldsToUpdate).length === 0) {
      return { affectedRows: 0 };
    }

    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(fieldsToUpdate), id];

    await db.pitar.execute(
      `UPDATE arbitros_disponibilidad SET ${setClause} WHERE id = ?`,
      values,
    );

    return this.getById(id);
  }

  // Updates only the `estado` column (assign / free a slot).
  static async updateEstado(id, estado) {
    await db.pitar.execute(
      "UPDATE arbitros_disponibilidad SET estado = ? WHERE id = ?",
      [estado, id],
    );
    return this.getById(id);
  }

  // Deletes one row. Returns the number of affected rows (0 when id unknown).
  static async remove(id) {
    const [result] = await db.pitar.execute(
      "DELETE FROM arbitros_disponibilidad WHERE id = ?",
      [id],
    );
    return result.affectedRows;
  }
}
