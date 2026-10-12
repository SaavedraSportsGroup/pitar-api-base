import { EmpleadoModel, TIPOS_ANEXO } from "../models/empleado.js";

/**
 * Build a safe filename for the Content-Disposition header.
 * Prefers `nombre_anexo`, falls back to the annex type; strips quotes,
 * backslashes and control characters (incl. CR/LF) and guarantees a `.pdf`
 * suffix so the header can never be broken by user-controlled input.
 */
const buildAnexoFilename = (nombre_anexo, tipo) => {
  const raw =
    typeof nombre_anexo === "string" && nombre_anexo.trim()
      ? nombre_anexo
      : tipo;
  const safe = raw.replace(/[\u0000-\u001F"\\]/g, "").trim();
  const base = safe || tipo;
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
};

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

  // Streams the stored PDF as a binary download (never wrapped in JSON).
  static getAnexoArchivo = async (req, res) => {
    try {
      const { id, tipo } = req.params; // id_empleado, tipo_anexo

      if (!TIPOS_ANEXO.includes(tipo))
        return res.status(400).json({ message: "Tipo de anexo inválido" });

      const anexo = await EmpleadoModel.getAnexoArchivo(id, tipo);

      if (!anexo || !anexo.archivo_anexo)
        return res.status(404).json({ message: "Anexo no encontrado" });

      const buffer = anexo.archivo_anexo; // Buffer (MEDIUMBLOB)
      const filename = buildAnexoFilename(anexo.nombre_anexo, tipo);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Length": buffer.length,
        "Content-Disposition": `inline; filename="${filename}"`,
      });

      return res.send(buffer);
    } catch (error) {
      console.log("Error al descargar el anexo.", error);
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

  static createAnexo = async (req, res) => {
    try {
      const { id } = req.params; // id_empleado
      const { tipo_anexo, nombre_anexo } = req.body;

      if (!req.file || !req.file.buffer)
        return res
          .status(400)
          .json({ message: "El archivo PDF es obligatorio" });

      if (!TIPOS_ANEXO.includes(tipo_anexo))
        return res.status(400).json({ message: "Tipo de anexo inválido" });

      const rows = await EmpleadoModel.upsertAnexo(
        id,
        tipo_anexo,
        nombre_anexo,
        req.file.buffer,
      );

      return res.status(201).json({
        message: "Anexo guardado exitosamente",
        anexo: { id_empleado: id, tipo_anexo, nombre_anexo },
        rows,
      });
    } catch (error) {
      console.log("Error al guardar el anexo.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };

  static deleteAnexo = async (req, res) => {
    try {
      const { id, tipo } = req.params; // id_empleado, tipo_anexo

      if (!TIPOS_ANEXO.includes(tipo))
        return res.status(400).json({ message: "Tipo de anexo inválido" });

      const rows = await EmpleadoModel.deleteAnexo(id, tipo);

      if (!rows || rows.affectedRows === 0)
        return res.status(404).json({ message: "Anexo no encontrado" });

      return res.json({
        message: "Anexo eliminado exitosamente",
        anexo: { id_empleado: id, tipo_anexo: tipo },
      });
    } catch (error) {
      console.log("Error al eliminar el anexo.", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
