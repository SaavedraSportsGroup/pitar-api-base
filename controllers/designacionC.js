import { DesignacionModel } from "../models/designacion.js";
import { CampeonatoModel } from "../models/campeonato.js";
import { sendDesignacionEmail } from "../config/mail.js";

const invalidId = (raw) => {
  const n = Number(raw);
  return !Number.isInteger(n) || n <= 0;
};

const invalidCodigo = (raw) =>
  typeof raw !== "string" || raw.trim().length === 0 || raw.trim().length > 7;

// Validates and normalizes the (campeonato, partido) key from the URL. Returns
// `{ error, message }` when invalid, or `{ idCampeonato, codigoPartido }`.
const getPartidoCtx = (req) => {
  const idCampeonato = Number(req.params.id);
  const codigoPartido = String(req.params.codigo ?? "").trim();
  if (invalidId(idCampeonato)) {
    return { error: 400, message: "id de campeonato inválido" };
  }
  if (invalidCodigo(codigoPartido)) {
    return { error: 400, message: "código de partido inválido" };
  }
  return { idCampeonato, codigoPartido };
};

// Returns a Spanish error message when the referee id is not an assignable
// employee (active user + ARB role), or null when valid.
const errorArbitro = async (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return "id de árbitro inválido (debe ser un entero positivo)";
  }
  const ok = await DesignacionModel.arbitroAsignable(n);
  return ok ? null : "Árbitro no asignable (debe ser un empleado activo con rol ARB)";
};

// Like errorArbitro, PLUS the business rule "la designación es solo para
// árbitros con disponibilidad para el partido": the employee must have a free
// (DISPONIBLE) slot covering the match date/time, or already be designated in
// that same match. Used for `id_arbitro_des` only.
const errorArbitroDesignado = async (raw, ctx) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return "id de árbitro inválido (debe ser un entero positivo)";
  }
  const ok = await DesignacionModel.arbitroAsignable(n);
  if (!ok) return "Árbitro no asignable (debe ser un empleado activo con rol ARB)";

  const partido = await DesignacionModel.datosPartido(ctx);
  if (!partido) return "No se pudo leer la fecha/hora del partido";

  const disponible = await DesignacionModel.arbitroDisponibleParaPartido(n, {
    ...ctx,
    fecha: partido.fecha,
    hora: partido.hora,
  });
  return disponible
    ? null
    : "El árbitro no tiene disponibilidad para la fecha/hora de este partido";
};

// --- Paso 5: bloqueo de franja y notificación --------------------------------

const formatearFecha = (iso) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
};

// Marks ASIGNADO (only if it was DISPONIBLE) the availability slot of the
// designated referee that covers the match date/time. Never fails the response:
// no slot → nothing to do.
const bloquearFranja = async (fila) => {
  if (!fila?.id_arbitro_des) return;
  try {
    const partido = await DesignacionModel.datosPartido({
      idCampeonato: fila.id_campeonato,
      codigoPartido: fila.codigo_partido,
    });
    if (!partido) return;
    const franja = await DesignacionModel.franjaQueCubre(
      fila.id_arbitro_des,
      partido.fecha,
      partido.hora,
    );
    if (franja && franja.estado === "DISPONIBLE") {
      await DesignacionModel.setEstadoFranja(franja.id, "ASIGNADO");
    }
  } catch (error) {
    console.error("Error al bloquear franja por designación:", error.message);
  }
};

// Reverts the slot to DISPONIBLE only when no OTHER active designation of the
// employee keeps covering it. Same non-blocking contract.
const liberarFranja = async (fila) => {
  if (!fila?.id_arbitro_des) return;
  try {
    const partido = await DesignacionModel.datosPartido({
      idCampeonato: fila.id_campeonato,
      codigoPartido: fila.codigo_partido,
    });
    if (!partido) return;
    const franja = await DesignacionModel.franjaQueCubre(
      fila.id_arbitro_des,
      partido.fecha,
      partido.hora,
    );
    if (!franja || franja.estado !== "ASIGNADO") return;
    const cubierta = await DesignacionModel.franjaCubiertaPorDesignacion({
      idEmpleado: fila.id_arbitro_des,
      fecha: partido.fecha,
      horaInicio: franja.hora_inicio,
      horaFin: franja.hora_fin,
      excluir: {
        idCampeonato: fila.id_campeonato,
        codigoPartido: fila.codigo_partido,
        idFuncion: fila.id_funcion,
      },
    });
    if (!cubierta) {
      await DesignacionModel.setEstadoFranja(franja.id, "DISPONIBLE");
    }
  } catch (error) {
    console.error("Error al liberar franja por designación:", error.message);
  }
};

// Fire-and-forget email to the designated referee. sendDesignacionEmail never
// throws, so failures only reach the console.
const notificarDesignacion = (fila) => {
  if (!fila?.des_email) return;
  (async () => {
    const partido = await DesignacionModel.datosPartido({
      idCampeonato: fila.id_campeonato,
      codigoPartido: fila.codigo_partido,
    });
    if (!partido) return;
    await sendDesignacionEmail({
      to: fila.des_email,
      nombre: fila.des_nombre,
      codigoPartido: fila.codigo_partido,
      funcion: `${fila.funcion_codigo} (${fila.funcion_nombre})`,
      fecha: formatearFecha(partido.fecha),
      hora: partido.hora?.slice(0, 5),
      lugar: partido.lugar,
      equipos: `${partido.equipo_1} vs ${partido.equipo_2}`,
    });
  })();
};

export class DesignacionController {
  // GET /api/campeonatos/:id/partidos/:codigo/arbitros
  static listar = async (req, res) => {
    try {
      const ctx = getPartidoCtx(req);
      if (ctx.error) return res.status(ctx.error).json({ message: ctx.message });

      const existe = await CampeonatoModel.partidoExiste(ctx);
      if (!existe) {
        return res.status(404).json({ message: "Partido no encontrado" });
      }

      const filas = await DesignacionModel.listarPorPartido(ctx);
      return res.json(filas);
    } catch (error) {
      console.log("Error al obtener designaciones.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // POST /api/campeonatos/:id/partidos/:codigo/arbitros
  // Body: { id_funcion, id_arbitro_des, id_arbitro_act? }
  static create = async (req, res) => {
    try {
      const ctx = getPartidoCtx(req);
      if (ctx.error) return res.status(ctx.error).json({ message: ctx.message });

      const programado = await CampeonatoModel.partidoProgramadoExiste(ctx);
      if (!programado) {
        return res
          .status(404)
          .json({ message: "Partido no encontrado o no está en estado Programado" });
      }

      const { id_funcion, id_arbitro_des, id_arbitro_act } = req.body ?? {};

      if (invalidId(id_funcion)) {
        return res
          .status(400)
          .json({ message: "id_funcion es obligatorio y debe ser un entero positivo" });
      }
      const funcionOk = await DesignacionModel.funcionExiste(Number(id_funcion));
      if (!funcionOk) {
        return res.status(400).json({ message: "Función no encontrada" });
      }

      const msgDes = await errorArbitroDesignado(id_arbitro_des, ctx);
      if (msgDes) return res.status(400).json({ message: msgDes });

      if (id_arbitro_act !== undefined && id_arbitro_act !== null) {
        const msgAct = await errorArbitro(id_arbitro_act);
        if (msgAct) return res.status(400).json({ message: msgAct });
      }

      const yaExiste = await DesignacionModel.getPorFuncion({
        ...ctx,
        idFuncion: Number(id_funcion),
      });
      if (yaExiste) {
        return res.status(409).json({
          message: "Ya existe una designación para esta función en el partido",
        });
      }

      const creada = await DesignacionModel.create({
        ...ctx,
        idFuncion: Number(id_funcion),
        idArbitroDes: Number(id_arbitro_des),
        idArbitroAct:
          id_arbitro_act === undefined || id_arbitro_act === null
            ? null
            : Number(id_arbitro_act),
      });

      await bloquearFranja(creada);
      notificarDesignacion(creada);

      return res.status(201).json(creada);
    } catch (error) {
      if (error?.errno === 1062) {
        return res.status(409).json({
          message: "Ya existe una designación para esta función en el partido",
        });
      }
      console.log("Error al crear designación.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // PUT /api/campeonatos/:id/partidos/:codigo/arbitros/:idFuncion
  // Body (at least one): { id_arbitro_des?, id_arbitro_act? (null clears it) }
  static update = async (req, res) => {
    try {
      const ctx = getPartidoCtx(req);
      if (ctx.error) return res.status(ctx.error).json({ message: ctx.message });

      const idFuncion = Number(req.params.idFuncion);
      if (invalidId(idFuncion)) {
        return res.status(400).json({ message: "id_funcion inválido" });
      }

      const actual = await DesignacionModel.getPorFuncion({ ...ctx, idFuncion });
      if (!actual) {
        return res.status(404).json({ message: "Designación no encontrada" });
      }

      const { id_arbitro_des, id_arbitro_act } = req.body ?? {};
      const campos = {};

      if (id_arbitro_des !== undefined && id_arbitro_des !== null) {
        const msg = await errorArbitroDesignado(id_arbitro_des, ctx);
        if (msg) return res.status(400).json({ message: msg });
        campos.id_arbitro_des = Number(id_arbitro_des);
      }
      if (id_arbitro_act !== undefined) {
        if (id_arbitro_act === null) {
          campos.id_arbitro_act = null;
        } else {
          const msg = await errorArbitro(id_arbitro_act);
          if (msg) return res.status(400).json({ message: msg });
          campos.id_arbitro_act = Number(id_arbitro_act);
        }
      }

      if (Object.keys(campos).length === 0) {
        return res
          .status(400)
          .json({ message: "No se enviaron campos para actualizar" });
      }

      const updated = await DesignacionModel.update({ ...ctx, idFuncion, campos });

      // When the designated referee changes: release the old slot, lock the new
      // one, and notify the incoming referee (fire-and-forget).
      if (updated.id_arbitro_des !== actual.id_arbitro_des) {
        await liberarFranja(actual);
        await bloquearFranja(updated);
        notificarDesignacion(updated);
      }

      return res.json(updated);
    } catch (error) {
      if (error?.errno === 1062) {
        return res.status(409).json({
          message: "Ya existe una designación para esta función en el partido",
        });
      }
      console.log("Error al actualizar designación.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // DELETE /api/campeonatos/:id/partidos/:codigo/arbitros/:idFuncion
  static remove = async (req, res) => {
    try {
      const ctx = getPartidoCtx(req);
      if (ctx.error) return res.status(ctx.error).json({ message: ctx.message });

      const idFuncion = Number(req.params.idFuncion);
      if (invalidId(idFuncion)) {
        return res.status(400).json({ message: "id_funcion inválido" });
      }

      const actual = await DesignacionModel.getPorFuncion({ ...ctx, idFuncion });
      if (!actual) {
        return res.status(404).json({ message: "Designación no encontrada" });
      }

      await DesignacionModel.remove({ ...ctx, idFuncion });
      await liberarFranja(actual);
      return res.json({ message: "Designación eliminada exitosamente" });
    } catch (error) {
      console.log("Error al eliminar designación.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // GET /api/designaciones/empleado/:idEmpleado
  // The employee's own designations (as designated referee), enriched with the
  // SISCAMP partido data. Ownership is enforced by the route middleware.
  static listarPorEmpleado = async (req, res) => {
    try {
      const idEmpleado = Number(req.params.idEmpleado);
      if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
        return res.status(400).json({ message: "idEmpleado inválido" });
      }

      const existe = await DesignacionModel.empleadoExiste(idEmpleado);
      if (!existe) {
        return res.status(404).json({ message: "Empleado no encontrado" });
      }

      const filas = await DesignacionModel.listarPorEmpleado(idEmpleado);
      return res.json(filas);
    } catch (error) {
      console.log("Error al obtener designaciones del empleado.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}