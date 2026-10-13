import { db } from "../config/db.js";

// Referee assignments live entirely in PITAR (`partidos_arbitros`): one row per
// (campeonato, partido, función). The designated referee (`id_arbitro_des`) and
// the one who actually acted (`id_arbitro_act`) may differ; a single referee
// can cover several functions of the same match. `codigo_partido` alone is NOT
// unique in SISCAMP (composite PK with the campeonato), hence every method is
// scoped by (id_campeonato, codigo_partido).

const BASE_SELECT = `
  SELECT
      pa.id
  ,   pa.id_campeonato
  ,   pa.codigo_partido
  ,   pa.id_funcion
  ,   af.codigo                                   AS funcion_codigo
  ,   af.nombre                                   AS funcion_nombre
  ,   pa.id_arbitro_des
  ,   des.username                                AS des_codigo
  ,   des.email                                   AS des_email
  ,   CONCAT(des_e.nombres, ' ', des_e.apellidos) AS des_nombre
  ,   pa.id_arbitro_act
  ,   act.username                                AS act_codigo
  ,   CONCAT(act_e.nombres, ' ', act_e.apellidos) AS act_nombre
  FROM partidos_arbitros pa
  JOIN arbitros_funciones af ON af.id = pa.id_funcion
  LEFT JOIN empleados des_e ON des_e.id = pa.id_arbitro_des
  LEFT JOIN usuarios  des   ON des.id = des_e.id_usuario
  LEFT JOIN empleados act_e ON act_e.id = pa.id_arbitro_act
  LEFT JOIN usuarios  act   ON act.id = act_e.id_usuario
`;

export class DesignacionModel {
  // All function slots of one match, ordered by the catalog position.
  static async listarPorPartido({ idCampeonato, codigoPartido }) {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT}
       WHERE pa.id_campeonato = ? AND pa.codigo_partido = ?
       ORDER BY af.orden`,
      [idCampeonato, codigoPartido],
    );
    return rows;
  }

  // One function slot (or undefined). Used as the uniqueness check too, since
  // the DB enforces UNIQUE (id_campeonato, codigo_partido, id_funcion).
  static async getPorFuncion({ idCampeonato, codigoPartido, idFuncion }) {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT}
       WHERE pa.id_campeonato = ? AND pa.codigo_partido = ? AND pa.id_funcion = ?`,
      [idCampeonato, codigoPartido, idFuncion],
    );
    return rows[0];
  }

  static async getById(id) {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT} WHERE pa.id = ?`,
      [id],
    );
    return rows[0];
  }

  static async funcionExiste(idFuncion) {
    const [rows] = await db.pitar.query(
      "SELECT 1 FROM arbitros_funciones WHERE id = ? LIMIT 1",
      [idFuncion],
    );
    return rows.length > 0;
  }

  // Assignable referees: ACTIVE employees whose user holds the ARB role.
  static async arbitroAsignable(idEmpleado) {
    const [rows] = await db.pitar.query(
      `SELECT 1
         FROM empleados e
         JOIN usuarios u     ON u.id = e.id_usuario AND u.activo = 1
         JOIN usuario_rol ur ON ur.id_usuario = u.id
         JOIN roles r        ON r.id = ur.id_rol AND r.codigo = 'ARB'
        WHERE e.id = ?
        LIMIT 1`,
      [idEmpleado],
    );
    return rows.length > 0;
  }

  static async create({
    idCampeonato,
    codigoPartido,
    idFuncion,
    idArbitroDes,
    idArbitroAct,
  }) {
    const [result] = await db.pitar.execute(
      `INSERT INTO partidos_arbitros
         (id_campeonato, codigo_partido, id_funcion, id_arbitro_des, id_arbitro_act)
       VALUES (?, ?, ?, ?, ?)`,
      [idCampeonato, codigoPartido, idFuncion, idArbitroDes, idArbitroAct],
    );
    return this.getById(result.insertId);
  }

  // Dynamic UPDATE restricted to the referee columns (the (campeonato, partido,
  // función) key is immutable). Returns the refreshed row.
  static async update({ idCampeonato, codigoPartido, idFuncion, campos }) {
    const setClause = Object.keys(campos)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(campos), idCampeonato, codigoPartido, idFuncion];

    await db.pitar.execute(
      `UPDATE partidos_arbitros SET ${setClause}
        WHERE id_campeonato = ? AND codigo_partido = ? AND id_funcion = ?`,
      values,
    );

    return this.getPorFuncion({ idCampeonato, codigoPartido, idFuncion });
  }

  static async remove({ idCampeonato, codigoPartido, idFuncion }) {
    const [result] = await db.pitar.execute(
      `DELETE FROM partidos_arbitros
        WHERE id_campeonato = ? AND codigo_partido = ? AND id_funcion = ?`,
      [idCampeonato, codigoPartido, idFuncion],
    );
    return result.affectedRows;
  }

  // --- Consulta del empleado y bloqueo de franjas (Paso 5) -------------------

  // Does the employee exist? (foreign key target of id_arbitro_des).
  static async empleadoExiste(idEmpleado) {
    const [rows] = await db.pitar.query(
      "SELECT 1 FROM empleados WHERE id = ? LIMIT 1",
      [idEmpleado],
    );
    return rows.length > 0;
  }

  // One employee's designations (as DESIGNATED referee), enriched with the
  // SISCAMP partido data. `codigo_partido` alone is not unique, hence the
  // composite key used to join v_partidos.
  static async listarPorEmpleado(idEmpleado) {
    const [rows] = await db.pitar.query(
      `${BASE_SELECT}
       WHERE pa.id_arbitro_des = ?
       ORDER BY pa.id_campeonato, pa.codigo_partido, af.orden`,
      [idEmpleado],
    );
    if (rows.length === 0) return rows;

    const pares = [...new Map(rows.map((r) => [
      `${r.id_campeonato}:${r.codigo_partido}`,
      [r.id_campeonato, r.codigo_partido],
    ])).values()];
    const where = pares.map(() => "(IdCamp = ? AND Codigo = ?)").join(" OR ");
    const [partidos] = await db.siscamp.query(
      `SELECT
          IdCamp                                   AS id_campeonato
      ,   Codigo                                   AS codigo_partido
      ,   DATE_FORMAT(Fecha, '%Y-%m-%d')           AS fecha
      ,   TIME_FORMAT(Hora, '%H:%i:%s')            AS hora
      ,   Lugar                                    AS lugar
      ,   equipo_1
      ,   equipo_2
      ,   Categoria                                AS categoria
      ,   Rama                                     AS rama
      ,   Estado                                   AS estado
       FROM v_partidos
       WHERE ${where}`,
      pares.flat(),
    );
    const porClave = new Map(
      partidos.map((p) => [`${p.id_campeonato}:${p.codigo_partido}`, p]),
    );
    return rows.map((r) => ({
      ...r,
      ...(porClave.get(`${r.id_campeonato}:${r.codigo_partido}`) || {}),
    }));
  }

  // Fecha/hora (y lugar/equipos para el correo) del partido en SISCAMP.
  static async datosPartido({ idCampeonato, codigoPartido }) {
    const [rows] = await db.siscamp.query(
      `SELECT
          DATE_FORMAT(Fecha, '%Y-%m-%d') AS fecha
      ,   TIME_FORMAT(Hora, '%H:%i:%s')  AS hora
      ,   Lugar                          AS lugar
      ,   equipo_1
      ,   equipo_2
       FROM v_partidos
       WHERE IdCamp = ? AND Codigo = ?
       LIMIT 1`,
      [idCampeonato, codigoPartido],
    );
    return rows[0];
  }

  // Availability slot of the employee that covers [fecha, hora]. Half-open
  // interval: hora_inicio <= hora < hora_fin.
  static async franjaQueCubre(idEmpleado, fecha, hora) {
    const [rows] = await db.pitar.query(
      `SELECT
          id
      ,   estado
      ,   TIME_FORMAT(hora_inicio, '%H:%i:%s') AS hora_inicio
      ,   TIME_FORMAT(hora_fin,   '%H:%i:%s')   AS hora_fin
       FROM arbitros_disponibilidad
       WHERE id_empleado = ? AND fecha = ?
         AND hora_inicio <= ? AND hora_fin > ?
       LIMIT 1`,
      [idEmpleado, fecha, hora, hora],
    );
    return rows[0];
  }

  // Does an ACTIVE designation of this employee cover the slot? Used to avoid
  // releasing an availability slot that another match keeps occupying.
  // `excluir` skips the designation being removed/relocated (same composite key).
  static async franjaCubiertaPorDesignacion({
    idEmpleado,
    fecha,
    horaInicio,
    horaFin,
    excluir,
  }) {
    const [designaciones] = await db.pitar.query(
      `SELECT id_campeonato, codigo_partido
         FROM partidos_arbitros
        WHERE id_arbitro_des = ?`,
      [idEmpleado],
    );
    for (const d of designaciones) {
      if (
        excluir &&
        d.id_campeonato === excluir.idCampeonato &&
        d.codigo_partido === excluir.codigoPartido
      ) {
        continue;
      }
      const partido = await this.datosPartido({
        idCampeonato: d.id_campeonato,
        codigoPartido: d.codigo_partido,
      });
      if (
        partido &&
        partido.fecha === fecha &&
        partido.hora >= horaInicio &&
        partido.hora < horaFin
      ) {
        return true;
      }
    }
    return false;
  }

  static async setEstadoFranja(id, estado) {
    await db.pitar.execute(
      "UPDATE arbitros_disponibilidad SET estado = ? WHERE id = ?",
      [estado, id],
    );
  }
}