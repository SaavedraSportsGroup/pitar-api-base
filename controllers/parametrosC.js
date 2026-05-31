import { ParametrosModel } from "../models/parametros.js";

export class ParametrosController {
  static getParametros = async (req, res) => {
    try {
      const roles = (await ParametrosModel.getRoles()) || [];
      const generos = (await ParametrosModel.getTablasCodigos("GENEROS")) || [];
      const tiposDocumento =
        (await ParametrosModel.getTablasCodigos("TIPO_DOCUMENTO")) || [];
      const anexosTipos =
        (await ParametrosModel.getTablasCodigos("ANEXOS_TIPOS")) || [];
      const tiposSangre =
        (await ParametrosModel.getTablasCodigos("TIPO_SANGRE")) || [];
      const rh = (await ParametrosModel.getTablasCodigos("RH")) || [];
      const tiposCuenta =
        (await ParametrosModel.getTablasCodigos("TIPO_CUENTA")) || [];
      const arbitrosCategoria =
        (await ParametrosModel.getTablasCodigos("ARBITROS_CATEGORIA")) || [];
      const arbitrosNivel =
        (await ParametrosModel.getTablasCodigos("ARBITROS_NIVEL")) || [];
      const arbitrosEspecialidad =
        (await ParametrosModel.getTablasCodigos("ARBITROS_ESPECIALIDAD")) || [];
      const data = {
        roles,
        generos,
        tiposDocumento,
        anexosTipos,
        tiposSangre,
        rh,
        tiposCuenta,
        arbitrosCategoria,
        arbitrosNivel,
        arbitrosEspecialidad,
      };
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}
