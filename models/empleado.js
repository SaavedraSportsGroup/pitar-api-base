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

const CAMPOS_EMPLEADO_ANEXOS = ["documento_identidad"];

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

  static async getAnexosById(id) {
    console.log("Obteniendo anexos para empleado:", id);
    const [rows] = await db.pitar.query(
      "SELECT * FROM v_empleados_anexos WHERE id_empleado = ?",
      [id],
    );
    console.log("Anexos obtenidos:", rows);
    return rows;
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

  static async updateEmpleadoAnexos(id_empleado, updateData) {
    // Filtrar solo los campos que no son null o undefined
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateData)
        .filter(([key]) => CAMPOS_EMPLEADO_ANEXOS.includes(key))
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
    values.push(updateData.tipo_anexo);

    const [rows] = await db.pitar.execute(
      `UPDATE empleados_anexos SET ${setClause} WHERE id_empleado = ? and tipo_anexo = ?`,
      values,
    );

    return {
      message: "Anexos actualizados exitosamente",
      fieldsUpdated: Object.keys(fieldsToUpdate),
      rows,
    };
  }
}
