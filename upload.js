const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Builds a multer instance that saves into a given subfolder of /uploads
// and only accepts the given file types.
function makeUploader(subfolder, allowedExt) {
  const dest = path.join(__dirname, 'uploads', subfolder);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) return cb(null, true);
    cb(new Error(`Only ${allowedExt.join(', ')} files are allowed.`));
  };

  const maxMB = Number(process.env.MAX_UPLOAD_MB || 15);

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxMB * 1024 * 1024 },
  });
}

// For question images
const uploadQuestionImage = makeUploader('questions', ['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// For library PDFs
const uploadLibraryFile = makeUploader('library', ['.pdf']);

module.exports = { uploadQuestionImage, uploadLibraryFile };
