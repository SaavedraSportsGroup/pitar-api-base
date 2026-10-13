import { db } from "../config/db.js";

// SISCAMP owns competitions and matches; PITAR only READS them through this
// model (pool `db.siscamp`). Every query here is read-only and never mutates
// the SISCAMP schema. DATE/TIME are projected as strings (DATE_FORMAT /
// TIME_FORMAT) so the JSON payload is a stable `YYYY-MM-DD` / `HH:MM:SS`,
// same convention as models/disponibilidad.js.

const BASE_CAMPEONATOS = `
  SELECT
      IdCamp                                  AS id
  ,   Nomcamp                                 AS nombre
  ,   CASE WHEN Activo = 'S' THEN TRUE ELSE FALSE END AS activo
  ,   Lugar                                   AS lugar
  ,   DATE_FORMAT(Finicio, '%Y-%m-%d')        AS fecha_inicio
  ,   DATE_FORMAT(Ffinal,  '%Y-%m-%d')        AS fecha_fin
  FROM campeonatos
`;

const BASE_PARTIDOS = `
  SELECT
      IdCamp                                  AS id_campeonato
  ,   Codigo                                  AS codigo
  ,   Numero                                  AS numero
  ,   DATE_FORMAT(Fecha, '%Y-%m-%d')          AS fecha
  ,   TIME_FORMAT(Hora,  '%H:%i:%s')          AS hora
  ,   Lugar                                   AS lugar
  ,   Categoria                               AS categoria
  ,   Rama                                    AS rama
  ,   equipo_1                                AS equipo_1
  ,   equipo_2                                AS equipo_2
  ,   Estado                                  AS estado
  FROM v_partidos
`;

export class CampeonatoModel {
  // All competitions, optionally narrowed to the ACTIVE ones (Activo='S').
  // `activo` is a boolean (CASE over the S/N enum), not a query filter.
  static async listar({ soloActivos = false } = {}) {
    const [rows] = await db.siscamp.query(
      `${BASE_CAMPEONATOS} ${
        soloActivos ? "WHERE Activo = 'S'" : ""
      } ORDER BY Nomcamp`,
    );
    return rows;
  }

  // Matches of one competition. Only `Programado` matches are assignable, so
  // Jugado/Cancelado/Pendiente are never returned by this endpoint.
  static async partidosDe(idCampeonato) {
    const [rows] = await db.siscamp.query(
      `${BASE_PARTIDOS} WHERE IdCamp = ? AND Estado = 'Programado' ORDER BY Numero ASC`,
      [idCampeonato],
    );
    return rows;
  }

  static async existe(idCampeonato) {
    const [rows] = await db.siscamp.query(
      "SELECT 1 FROM campeonatos WHERE IdCamp = ? LIMIT 1",
      [idCampeonato],
    );
    return rows.length > 0;
  }

  // A (campeonato, codigo) match exists in any state.
  static async partidoExiste({ idCampeonato, codigoPartido }) {
    const [rows] = await db.siscamp.query(
      "SELECT 1 FROM v_partidos WHERE IdCamp = ? AND Codigo = ? LIMIT 1",
      [idCampeonato, codigoPartido],
    );
    return rows.length > 0;
  }

  // A (campeonato, codigo) match that is still Programado → assignable.
  static async partidoProgramadoExiste({ idCampeonato, codigoPartido }) {
    const [rows] = await db.siscamp.query(
      `SELECT 1 FROM v_partidos
       WHERE IdCamp = ? AND Codigo = ? AND Estado = 'Programado'
       LIMIT 1`,
      [idCampeonato, codigoPartido],
    );
    return rows.length > 0;
  }
}