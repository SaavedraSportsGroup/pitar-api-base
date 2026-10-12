import { ArbitroModel } from "../models/arbitro.js";

// Read-only controller. Writes to an árbitro belong to `/api/usuarios` (create
// user / assign the ARB role) and `/api/empleados` (CV data), so none are
// duplicated here.
export class ArbitroController {
  static getAll = async (req, res) => {
    try {
      const arbitros = await ArbitroModel.getAll();
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
