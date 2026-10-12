import { db } from "../config/db.js";

// A "árbitro" in PITAR is a `usuarios` row holding the ARB role (via
// `usuario_rol`). The person's data lives in `empleados` and the sporting level
// in `arbitros_nivel`. This model is READ-ONLY and never touches SISCAMP:
// PITAR owns the árbitro identity; SISCAMP owns competition assignments.

// Base projection shared by every read, so the JSON shape stays consistent.
const BASE_SELECT = `
  SELECT
      u.id                                     AS id
  ,   u.username                               AS codigo
  ,   u.username                               AS username
  ,   e.id                                     AS id_empleado
  ,   CONCAT(e.nombres, ' ', e.apellidos)      AS nombre
  ,   u.email                                  AS email
  ,   u.activo                                 AS activo
  ,   an.categoria                             AS categoria
  ,   an.rango                                 AS rango
  ,   an.especialidad                          AS especialidad
  FROM usuarios u
  JOIN usuario_rol ur ON ur.id_usuario = u.id
  JOIN roles r ON r.id = ur.id_rol AND r.codigo = 'ARB'
  LEFT JOIN empleados e ON e.id_usuario = u.id
  LEFT JOIN arbitros_nivel an ON an.id_empleado = e.id
`;

export class ArbitroModel {
  // All users whose role is ARB. `activo` is projected, not filtered, so
  // consumers can show inactive árbitros too.
  static async getAll() {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT} ORDER BY nombre, u.username`,
    );
    return rows;
  }

  // One árbitro by `usuarios.id`.
  static async getById(id) {
    const [rows] = await db.pitar.query(`${BASE_SELECT} WHERE u.id = ?`, [id]);
    return rows[0];
  }

  // One árbitro by `usuarios.username` (the login code).
  static async getByCodigo(codigo) {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT} WHERE u.username = ?`,
      [codigo],
    );
    return rows[0];
  }
}
