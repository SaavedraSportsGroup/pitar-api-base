import { CampeonatoModel } from "../models/campeonato.js";

const invalidId = (raw) => {
  const n = Number(raw);
  return !Number.isInteger(n) || n <= 0;
};

// Read-only bridge to SISCAMP. Competitions and matches are never mutated
// here: PITAR only consumes them for the referee assignment flow.
export class CampeonatoController {
  // GET /api/campeonatos?activo=1  → only competitions with Activo='S'
  static getAll = async (req, res) => {
    try {
      const soloActivos = req.query.activo === "1";
      const campeonatos = (await CampeonatoModel.listar({ soloActivos })).map(
        (c) => ({ ...c, activo: c.activo === 1 || c.activo === true }),
      );
      return res.json(campeonatos);
    } catch (error) {
      console.log("Error al obtener campeonatos.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  // GET /api/campeonatos/:id/partidos  → only assignable (Programado) matches
  static getPartidos = async (req, res) => {
    try {
      const { id } = req.params;
      if (invalidId(id)) {
        return res.status(400).json({ message: "id de campeonato inválido" });
      }

      const existe = await CampeonatoModel.existe(Number(id));
      if (!existe) {
        return res.status(404).json({ message: "Campeonato no encontrado" });
      }

      const partidos = await CampeonatoModel.partidosDe(Number(id));
      return res.json(partidos);
    } catch (error) {
      console.log("Error al obtener partidos.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}