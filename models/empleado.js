import { db } from "../config/db.js";

const CAMPOS_BASE = [
  "tipo_documento",
  "fecha_nacimiento",
  "genero",
  "telefono",
  "direccion",
  "ciudad",
  "departamento",
  "pais",
  "profesion",
  "talla_camiseta",
  "talla_pantalon",
  "foto",
];

const CAMPOS_EMPLEADO_SALUD = [
  "tipo_sangre",
  "rh",
  "eps",
  "lugar_atencion",
  "contacto_emergencia",
  "parentesco_emergencia",
  "telefono_emergencia",
];

const CAMPOS_EMPLEADO_FINANCIERO = [
  "entidad_financiera",
  "tipo_cuenta",
  "numero_cuenta",
];

// Allowed values for `empleados_anexos.tipo_anexo` (matches the DB ENUM).
export const TIPOS_ANEXO = ["DNI", "RUT", "CCB"];

export class EmpleadoModel {
  static async getEmpleadoId(id_usuario) {
    const [rows] = await db.pitar.query(
      "SELECT id_empleado FROM v_empleados WHERE id_usuario = ?",
      [id_usuario],
    );
    return rows[0];
  }

  static async getById(id) {
    const [rows] = await db.pitar.query(
      "SELECT * FROM v_empleados WHERE id_empleado = ?",
      [id],
    );
    return rows[0];
  }

  // Metadata only: the MEDIUMBLOB is never selected, so it can never leak into
  // the JSON payload. `bytes` exposes the file size via OCTET_LENGTH instead.
  static async getAnexosById(id) {
    const [rows] = await db.pitar.query(
      `SELECT tipo_anexo, nombre_anexo, fecha_actualizacion,
              OCTET_LENGTH(archivo_anexo) AS bytes
         FROM v_empleados_anexos
        WHERE id_empleado = ?`,
      [id],
    );
    return rows;
  }

  // Returns the raw PDF buffer for one annex (or null when it does not exist).
  static async getAnexoArchivo(id_empleado, tipo_anexo) {
    const [rows] = await db.pitar.query(
      `SELECT nombre_anexo, archivo_anexo
         FROM empleados_anexos
        WHERE id_empleado = ? AND tipo_anexo = ?`,
      [id_empleado, tipo_anexo],
    );
    return rows[0] ?? null;
  }

  static async updateEmpleado(id, updateData) {
    console.log("Model | updateData:", updateData);
    let fotoValue = null;
    if (updateData.foto !== undefined) {
      fotoValue = updateData.foto; // Buffer, null o undefined
    }

    // Filtrar solo los campos que no son null o undefined
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateData)
        .filter(([key]) => CAMPOS_BASE.includes(key) && key !== "foto")
        .filter(
          ([_, value]) => value !== null && value !== undefined && value !== "",
        ),
    );

    if (fotoValue !== undefined) {
      fieldsToUpdate.foto = fotoValue;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return { message: "No hay campos para actualizar", rows: [] };
    }

    // Construir dinámicamente la consulta UPDATE
    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = Object.values(fieldsToUpdate);
    values.push(id);

    const [rows] = await db.pitar.execute(
      `UPDATE empleados SET ${setClause} WHERE id = ?`,
      values,
    );

    return {
      message: "Información básica actualizada exitosamente",
      fieldsUpdated: Object.keys(fieldsToUpdate),
      rows,
    };
  }

  static async updateEmpleadoSalud(id_empleado, updateData) {
    // Filtrar solo los campos que no son null o undefined
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateData)
        .filter(([key]) => CAMPOS_EMPLEADO_SALUD.includes(key))
        .filter(
          ([_, value]) => value !== null && value !== undefined && value !== "",
        ),
    );

    if (Object.keys(fieldsToUpdate).length === 0) {
      return { message: "No hay campos para actualizar", rows: [] };
    }

    // Construir dinámicamente la consulta UPDATE
    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = Object.values(fieldsToUpdate);
    values.push(id_empleado);

    const [rows] = await db.pitar.execute(
      `UPDATE empleados_salud SET ${setClause} WHERE id_empleado = ?`,
      values,
    );

    return {
      message: "Información de salud actualizada exitosamente",
      fieldsUpdated: Object.keys(fieldsToUpdate),
      rows,
    };
  }

  static async updateEmpleadoFinanciero(id_empleado, updateData) {
    // Filtrar solo los campos que no son null o undefined
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateData)
        .filter(([key]) => CAMPOS_EMPLEADO_FINANCIERO.includes(key))
        .filter(
          ([_, value]) => value !== null && value !== undefined && value !== "",
        ),
    );

    if (Object.keys(fieldsToUpdate).length === 0) {
      return { message: "No hay campos para actualizar", rows: [] };
    }

    // Construir dinámicamente la consulta UPDATE
    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = Object.values(fieldsToUpdate);
    values.push(id_empleado);

    const [rows] = await db.pitar.execute(
      `UPDATE empleados_financiero SET ${setClause} WHERE id_empleado = ?`,
      values,
    );

    return {
      message: "Información financiera actualizada exitosamente",
      fieldsUpdated: Object.keys(fieldsToUpdate),
      rows,
    };
  }

  static async upsertAnexo(id_empleado, tipo_anexo, nombre_anexo, archivoBuffer) {
    if (!TIPOS_ANEXO.includes(tipo_anexo)) {
      throw new Error(`Tipo de anexo inválido: ${tipo_anexo}`);
    }

    const [rows] = await db.pitar.execute(
      `INSERT INTO empleados_anexos (id_empleado, tipo_anexo, nombre_anexo, archivo_anexo)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre_anexo = VALUES(nombre_anexo),
         archivo_anexo = VALUES(archivo_anexo)`,
      [id_empleado, tipo_anexo, nombre_anexo, archivoBuffer],
    );

    return rows;
  }

  static async deleteAnexo(id_empleado, tipo_anexo) {
    const [rows] = await db.pitar.execute(
      "DELETE FROM empleados_anexos WHERE id_empleado = ? AND tipo_anexo = ?",
      [id_empleado, tipo_anexo],
    );

    return rows;
  }
}
