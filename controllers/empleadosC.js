import { EmpleadoModel } from "../models/empleado.js";

export class EmpleadoController {
  static getEmpleadoId = async (req, res) => {
    try {
      const { id } = req.params;
      const empleadoId = await EmpleadoModel.getEmpleadoId(id);

      if (!empleadoId)
        return res
          .status(404)
          .json({ message: "ID del empleado no encontrado" });

      return res.json(empleadoId);
    } catch (error) {
      console.log("Error al obtener el ID del empleado.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getById = async (req, res) => {
    try {
      const { id } = req.params;

      const empleado = await EmpleadoModel.getById(id);

      if (!empleado)
        return res.status(404).json({ message: "Empleado no encontrado" });

      return res.json(empleado);
    } catch (error) {
      console.log("Error al obtener usuario.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static getAnexosById = async (req, res) => {
    try {
      const { id } = req.params;
      const anexos = await EmpleadoModel.getAnexosById(id);
      return res.json(anexos);
    } catch (error) {
      console.log("Error al obtener anexos.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static updateEmpleado = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      console.log("Controller | Body:", updateData);

      // Eliminar id_usuario de los datos a actualizar
      delete updateData.id_usuario;

      if (!req.body.foto) {
        updateData.foto = !req.body.foto ? null : req.body.foto.buffer;
      }

      const updatedEmpleado = await EmpleadoModel.updateEmpleado(
        id,
        updateData,
      );

      if (!updatedEmpleado.rows || updatedEmpleado.rows.affectedRows === 0)
        return res
          .status(204)
          .json({ error: "Información básica no actualizada" });

      return res.json(updatedEmpleado);
    } catch (error) {
      console.log("Error al actualizar la información básica.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static updateEmpleadoSalud = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      const updatedEmpleadoSalud = await EmpleadoModel.updateEmpleadoSalud(
        id,
        updateData,
      );

      if (
        !updatedEmpleadoSalud.rows ||
        updatedEmpleadoSalud.rows.affectedRows === 0
      )
        return res
          .status(204)
          .json({ error: "Información de salud no actualizada" });

      return res.json(updatedEmpleadoSalud);
    } catch (error) {
      console.log("Error al actualizar la información de salud.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static updateEmpleadoFinanciero = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      const updatedEmpleadoFinanciero =
        await EmpleadoModel.updateEmpleadoFinanciero(id, updateData);

      if (
        !updatedEmpleadoFinanciero.rows ||
        updatedEmpleadoFinanciero.rows.affectedRows === 0
      )
        return res
          .status(204)
          .json({ error: "Información financiera no actualizada" });

      return res.json(updatedEmpleadoFinanciero);
    } catch (error) {
      console.log(
        "Error al actualizar la información financiera del empleado.",
        error,
      );
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static updateEmpleadoAnexos = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      const updatedEmpleadoAnexos = await EmpleadoModel.updateEmpleadoAnexos(
        id,
        updateData,
      );

      if (
        !updatedEmpleadoAnexos.rows ||
        updatedEmpleadoAnexos.rows.affectedRows === 0
      )
        return res.status(204).json({ error: "Anexos no actualizados" });

      return res.json(updatedEmpleadoAnexos);
    } catch (error) {
      console.log("Error al actualizar los anexos.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
