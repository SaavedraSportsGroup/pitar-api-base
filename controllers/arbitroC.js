import { ArbitroModel } from "../models/arbitro.js";

// Optional availability filter: ?fecha=YYYY-MM-DD&hora=HH:MM[:SS]. Both must be
// present; hora is normalized to 'HH:MM:SS' to match the stored TIME format.
const parseDisponibilidad = (req, res) => {
  const { fecha, hora } = req.query ?? {};
  if (fecha === undefined && hora === undefined) return {};
  if (
    typeof fecha !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    typeof hora !== "string" ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(hora)
  ) {
    res
      .status(400)
      .json({ message: "Los filtros exigen fecha (YYYY-MM-DD) y hora (HH:MM)" });
    return null;
  }
  return { fecha, hora: hora.length === 5 ? `${hora}:00` : hora };
};

// Read-only controller. Writes to an árbitro belong to `/api/usuarios` (create
// user / assign the ARB role) and `/api/empleados` (CV data), so none are
// duplicated here.
export class ArbitroController {
  static getAll = async (req, res) => {
    try {
      const filtro = parseDisponibilidad(req, res);
      if (filtro === null) return;
      const arbitros = await ArbitroModel.getAll(filtro);
      return res.json(arbitros);
    } catch (error) {
      console.log("Error al obtener árbitros.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getById = async (req, res) => {
    try {
      const { id } = req.params;

      const arbitro = await ArbitroModel.getById(id);

      if (!arbitro)
        return res.status(404).json({ message: "Árbitro no encontrado" });

      return res.json(arbitro);
    } catch (error) {
      console.log("Error al obtener árbitro.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getByCodigo = async (req, res) => {
    try {
      const { codigo } = req.params;

      const arbitro = await ArbitroModel.getByCodigo(codigo);

      if (!arbitro)
        return res.status(404).json({ message: "Árbitro no encontrado" });

      return res.json(arbitro);
    } catch (error) {
      console.log("Error al obtener árbitro por código.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
