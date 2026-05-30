import { db } from "../config/db.js";

export class ParametrosModel {
  static async getTablasCodigos(tabla) {
    const [rows] = await db.pitar.query(
      "SELECT * FROM tablas_codigos WHERE tabla = ?",
      [tabla],
    );
    return rows;
  }

  static async getRoles() {
    const [rows] = await db.pitar.query("SELECT * FROM roles");
    return rows;
  }
}
