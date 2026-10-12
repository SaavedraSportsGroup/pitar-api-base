import multer from "multer";

/**
 * File-upload middleware for employee annexes.
 *
 * Annexes are stored as MEDIUMBLOB in `empleados_anexos.archivo_anexo`, so the
 * file is kept in memory and handed to the model as a Buffer (no disk writes).
 * Only PDF files up to 5 MB are accepted.
 */

export const ALLOWED_ANEXO_MIME = "application/pdf";
export const MAX_ANEXO_SIZE = 5 * 1024 * 1024; // 5 MB in bytes


const storage = multer.memoryStorage();

// Reject anything that is not a PDF with a clear, user-facing message.
const fileFilter = (req, file, cb) => {
  if (file.mimetype === ALLOWED_ANEXO_MIME) {
    return cb(null, true);
  }
  return cb(new Error("Solo se permiten archivos PDF"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_ANEXO_SIZE },
});

const uploadSingleAnexo = upload.single("archivo");

/**
 * Translate an upload failure into a JSON response instead of letting the raw
 * error bubble up (which would crash the request with an HTML 500).
 *
 * - Oversized files -> 413 Payload Too Large
 * - Any other upload error (wrong type, unexpected field, ...) -> 400
 *
 * @param {Error} err
 * @param {import("express").Response} res
 * @returns {import("express").Response}
 */
export const handleUploadError = (err, res) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ message: "El archivo supera el límite de 5 MB" });
  }
  return res
    .status(400)
    .json({ message: err.message || "Error al procesar el archivo" });
};

/**
 * Ready-to-use middleware: parses a single PDF from the `archivo` field into
 * `req.file` (in-memory) and maps any upload error to JSON.
 *
 * @type {import("express").RequestHandler}
 */
export const uploadAnexo = (req, res, next) => {
  uploadSingleAnexo(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res);
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "El archivo PDF es obligatorio" });
    }
    return next();
  });
};
