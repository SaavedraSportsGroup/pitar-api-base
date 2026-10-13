import { DisponibilidadModel } from "../models/disponibilidad.js";

// Allowed values for `arbitros_disponibilidad.estado` (matches the DB ENUM).
export const ESTADOS = ["DISPONIBLE", "ASIGNADO", "OCUPADO", "PROGRAMADO"];

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

// Normalize "HH:MM" / "HH:MM:SS" to a lexicographically comparable "HH:MM:SS".
// Time-zone note: schedules are managed in the server's LOCAL time (the app
// runs single-host and the frontend works with local dates), so "today" and the
// date comparison use the server-local date instead of UTC, avoiding an
// off-by-one day near midnight.
const normalizeHora = (hora) => (hora.length === 5 ? `${hora}:00` : hora);

const hoyLocal = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Validates the SHAPE of whichever fields were provided (undefined = omitted).
// Returns null when valid, or a Spanish message when not.
const validateFields = ({ fecha, horaInicio, horaFin, estado }) => {
  if (fecha !== undefined && (typeof fecha !== "string" || !RE_FECHA.test(fecha))) {
    return "fecha debe tener el formato YYYY-MM-DD";
  }
  if (
    horaInicio !== undefined &&
    (typeof horaInicio !== "string" || !RE_HORA.test(horaInicio))
  ) {
    return "hora_inicio debe tener el formato HH:MM o HH:MM:SS";
  }
  if (
    horaFin !== undefined &&
    (typeof horaFin !== "string" || !RE_HORA.test(horaFin))
  ) {
    return "hora_fin debe tener el formato HH:MM o HH:MM:SS";
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return `estado debe ser uno de: ${ESTADOS.join(", ")}`;
  }
  return null;
};

const invalidId = (raw) => {
  const n = Number(raw);
  return !Number.isInteger(n) || n <= 0;
};

export class DisponibilidadController {
  // GET /api/disponibilidad/:idEmpleado  (fecha | desde+hasta son obligatorios)
  static getByEmpleado = async (req, res) => {
    try {
      const { idEmpleado } = req.params;
      if (invalidId(idEmpleado)) {
        return res.status(400).json({ message: "idEmpleado inválido" });
      }

      const { fecha, desde, hasta } = req.query;

      if (!fecha && !(desde && hasta)) {
        return res.status(400).json({
          message: "Debe indicar 'fecha' o el rango 'desde' y 'hasta'",
        });
      }

      if (fecha !== undefined && (typeof fecha !== "string" || !RE_FECHA.test(fecha))) {
        return res.status(400).json({ message: "fecha debe tener el formato YYYY-MM-DD" });
      }
      if (desde !== undefined && (typeof desde !== "string" || !RE_FECHA.test(desde))) {
        return res.status(400).json({ message: "desde debe tener el formato YYYY-MM-DD" });
      }
      if (hasta !== undefined && (typeof hasta !== "string" || !RE_FECHA.test(hasta))) {
        return res.status(400).json({ message: "hasta debe tener el formato YYYY-MM-DD" });
      }
      if (desde && hasta && desde > hasta) {
        return res.status(400).json({ message: "'desde' no puede ser posterior a 'hasta'" });
      }

      const rows = await DisponibilidadModel.getByEmpleado({
        idEmpleado: Number(idEmpleado),
        fecha,
        desde,
        hasta,
      });

      return res.json(rows);
    } catch (error) {
      console.log("Error al obtener la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // GET /api/disponibilidad/estado/:idEmpleado?fecha=YYYY-MM-DD
  // Franjas of one day with their `estado`, ordered by start time. `fecha`
  // defaults to the server-local today.
  static getEstado = async (req, res) => {
    try {
      const { idEmpleado } = req.params;
      if (invalidId(idEmpleado)) {
        return res.status(400).json({ message: "idEmpleado inválido" });
      }

      const fecha =
        typeof req.query.fecha === "string" && req.query.fecha
          ? req.query.fecha
          : hoyLocal();

      if (!RE_FECHA.test(fecha)) {
        return res.status(400).json({ message: "fecha debe tener el formato YYYY-MM-DD" });
      }

      const rows = await DisponibilidadModel.getByEmpleado({
        idEmpleado: Number(idEmpleado),
        fecha,
      });

      return res.json(rows);
    } catch (error) {
      console.log("Error al obtener el estado de la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // POST /api/disponibilidad
  static create = async (req, res) => {
    try {
      const { id_empleado, fecha, hora_inicio, hora_fin } = req.body ?? {};

      const idEmpleado = Number(id_empleado);
      if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
        return res.status(400).json({
          message: "id_empleado es obligatorio y debe ser un entero positivo",
        });
      }

      const existe = await DisponibilidadModel.empleadoExists(idEmpleado);
      if (!existe) {
        return res.status(404).json({ message: "Empleado no encontrado" });
      }

      if (fecha === undefined || hora_inicio === undefined || hora_fin === undefined) {
        return res.status(400).json({
          message: "fecha, hora_inicio y hora_fin son obligatorios",
        });
      }

      const shape = validateFields({ fecha, horaInicio: hora_inicio, horaFin: hora_fin });
      if (shape) {
        return res.status(400).json({ message: shape });
      }

      if (normalizeHora(hora_inicio) >= normalizeHora(hora_fin)) {
        return res.status(400).json({
          message: "hora_inicio debe ser anterior a hora_fin",
        });
      }

      if (fecha < hoyLocal()) {
        return res.status(400).json({ message: "fecha no puede ser anterior a hoy" });
      }

      const solapa = await DisponibilidadModel.existsOverlap({
        idEmpleado,
        fecha,
        horaInicio: hora_inicio,
        horaFin: hora_fin,
      });
      if (solapa) {
        return res.status(400).json({
          message:
            "El horario se solapa con una franja existente para ese empleado y fecha",
        });
      }

      // POST siempre crea en "DISPONIBLE"; el estado solo cambia vía PATCH /estado.
      const created = await DisponibilidadModel.create({
        idEmpleado,
        fecha,
        horaInicio: hora_inicio,
        horaFin: hora_fin,
      });

      return res.status(201).json(created);
    } catch (error) {
      console.log("Error al crear la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // PUT /api/disponibilidad/:id
  static update = async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await DisponibilidadModel.getById(id);
      if (!existing) {
        return res.status(404).json({ message: "Disponibilidad no encontrada" });
      }

      if (existing.estado !== "DISPONIBLE") {
        return res.status(409).json({ message: "Solo se puede modificar una franja en estado DISPONIBLE" });
      }

      const { fecha, hora_inicio, hora_fin, estado } = req.body ?? {};

      const shape = validateFields({ fecha, horaInicio: hora_inicio, horaFin: hora_fin, estado });
      if (shape) {
        return res.status(400).json({ message: shape });
      }

      // Effective values = provided overrides merged onto the stored row, used
      // both for the interval check and the (excludeId) overlap check.
      const effFecha = fecha !== undefined ? fecha : existing.fecha;
      const effInicio = hora_inicio !== undefined ? hora_inicio : existing.hora_inicio;
      const effFin = hora_fin !== undefined ? hora_fin : existing.hora_fin;

      if (normalizeHora(effInicio) >= normalizeHora(effFin)) {
        return res.status(400).json({
          message: "hora_inicio debe ser anterior a hora_fin",
        });
      }

      if (effFecha < hoyLocal()) {
        return res.status(400).json({ message: "fecha no puede ser anterior a hoy" });
      }

      const fields = {};
      if (fecha !== undefined) fields.fecha = fecha;
      if (hora_inicio !== undefined) fields.hora_inicio = hora_inicio;
      if (hora_fin !== undefined) fields.hora_fin = hora_fin;
      if (estado !== undefined) fields.estado = estado;

      if (Object.keys(fields).length === 0) {
        return res
          .status(400)
          .json({ message: "No se enviaron campos para actualizar" });
      }

      const solapa = await DisponibilidadModel.existsOverlap({
        idEmpleado: existing.id_empleado,
        fecha: effFecha,
        horaInicio: effInicio,
        horaFin: effFin,
        excludeId: id,
      });
      if (solapa) {
        return res.status(400).json({
          message:
            "El horario se solapa con una franja existente para ese empleado y fecha",
        });
      }

      const updated = await DisponibilidadModel.update(id, fields);

      return res.json(updated);
    } catch (error) {
      console.log("Error al actualizar la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // PATCH /api/disponibilidad/:id/estado
  static updateEstado = async (req, res) => {
    try {
      const { id } = req.params;
      const { estado } = req.body ?? {};

      if (!ESTADOS.includes(estado)) {
        return res
          .status(400)
          .json({ message: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
      }

      const existing = await DisponibilidadModel.getById(id);
      if (!existing) {
        return res.status(404).json({ message: "Disponibilidad no encontrada" });
      }

      const updated = await DisponibilidadModel.updateEstado(id, estado);

      return res.json(updated);
    } catch (error) {
      console.log("Error al actualizar el estado de la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // DELETE /api/disponibilidad/:id
  static remove = async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await DisponibilidadModel.getById(id);
      if (!existing) {
        return res.status(404).json({ message: "Disponibilidad no encontrada" });
      }

      if (existing.estado !== "DISPONIBLE") {
        return res.status(409).json({ message: "Solo se puede eliminar una franja en estado DISPONIBLE" });
      }

      await DisponibilidadModel.remove(id);

      return res.json({ message: "Disponibilidad eliminada exitosamente" });
    } catch (error) {
      console.log("Error al eliminar la disponibilidad.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
