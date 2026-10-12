import multer from "multer";

/**
 * File-upload middleware for employee annexes.
 *
 * Annexes are stored as MEDIUMBLOB in `empleados_anexos.archivo_anexo`, so the
 * file is kept in memory and handed to the model as a Buffer (no disk writes).
 * Only PDF files up to 1 MB are accepted.
 */

export const ALLOWED_ANEXO_MIME = "application/pdf";
export const MAX_ANEXO_SIZE = 1 * 1024 * 1024; // 1 MB in bytes

// Employee photo (`empleados.foto`, MEDIUMBLOB). Stored in memory and handed to
// the model as a Buffer, same as annexes; only common image types are accepted.
export const ALLOWED_FOTO_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const MAX_FOTO_SIZE = 1 * 1024 * 1024; // 1 MB in bytes


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

// Reject anything that is not a supported image type.
const fotoFileFilter = (req, file, cb) => {
  if (ALLOWED_FOTO_MIMES.includes(file.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error("Solo se permiten imágenes JPG, PNG, WEBP o GIF"));
};

const uploadFotoMulter = multer({
  storage: multer.memoryStorage(),
  fileFilter: fotoFileFilter,
  limits: { fileSize: MAX_FOTO_SIZE },
}).single("foto");

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
export const handleUploadError = (
  err,
  res,
  sizeMessage = "El archivo supera el límite de 1 MB",
) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: sizeMessage });
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

/**
 * Ready-to-use middleware for the employee photo: parses a single image from the
 * `foto` field into `req.file` (in-memory) and maps any upload error to JSON.
 *
 * The photo is OPTIONAL: a PATCH may update other fields without replacing the
 * image, so a missing file is not an error.
 *
 * @type {import("express").RequestHandler}
 */
export const uploadFoto = (req, res, next) => {
  uploadFotoMulter(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res, "La imagen supera el límite de 1 MB");
    }
    return next();
  });
};
