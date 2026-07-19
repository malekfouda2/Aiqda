import fs from 'fs';
import { promises as fsPromises } from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads');
const lessonsDir = path.join(uploadsDir, 'lessons');
const teamMembersDir = path.join(uploadsDir, 'team-members');
const partnersDir = path.join(uploadsDir, 'partners');
const authenticationDir = path.join(uploadsDir, 'authentication');

[uploadsDir, lessonsDir, teamMembersDir, partnersDir, authenticationDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const createStorage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const defaultStorage = createStorage(uploadsDir);
const lessonStorage = createStorage(lessonsDir);
const teamMemberStorage = createStorage(teamMembersDir);
const partnerStorage = createStorage(partnersDir);
const authenticationStorage = createStorage(authenticationDir);

const MAX_SIGNATURE_SAMPLE_BYTES = 256 * 1024;

const FILE_KIND_MESSAGES = {
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  webp: 'WebP',
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  txt: 'TXT',
  svg: 'SVG',
};

const FILE_KIND_EXTENSIONS = {
  jpeg: ['.jpg', '.jpeg'],
  png: ['.png'],
  gif: ['.gif'],
  webp: ['.webp'],
  pdf: ['.pdf'],
  doc: ['.doc'],
  docx: ['.docx'],
  txt: ['.txt'],
  svg: ['.svg'],
};

const readFileSample = async (filePath, maxBytes = MAX_SIGNATURE_SAMPLE_BYTES) => {
  const handle = await fsPromises.open(filePath, 'r');
  try {
    const stats = await handle.stat();
    const length = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
};

const deleteUploadedFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[uploads] Failed to remove rejected upload:', filePath, error.message);
    }
  }
};

const hasSignature = (buffer, signature) => (
  buffer.length >= signature.length
  && signature.every((byte, index) => buffer[index] === byte)
);

const bufferContainsText = (buffer, text) => buffer.toString('latin1').includes(text);

const isLikelyText = (buffer) => {
  if (buffer.length === 0) {
    return true;
  }

  let disallowedControlBytes = 0;
  for (const byte of buffer) {
    if (byte === 0x00) {
      return false;
    }

    const isAsciiControl = byte < 0x20 && ![0x09, 0x0a, 0x0d].includes(byte);
    if (isAsciiControl) {
      disallowedControlBytes += 1;
    }
  }

  return disallowedControlBytes / buffer.length < 0.02;
};

const isSvgMarkup = (buffer) => {
  const content = buffer.toString('utf8').trimStart();
  if (!/<svg[\s>]/i.test(content)) {
    return false;
  }

  return !/(<script\b|onload\s*=|onerror\s*=|<foreignobject\b|javascript:)/i.test(content);
};

const detectFileKinds = (buffer) => {
  const detectedKinds = new Set();

  if (hasSignature(buffer, [0xff, 0xd8, 0xff])) {
    detectedKinds.add('jpeg');
  }

  if (hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    detectedKinds.add('png');
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.slice(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      detectedKinds.add('gif');
    }
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.slice(0, 4).toString('ascii');
    const webpHeader = buffer.slice(8, 12).toString('ascii');
    if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
      detectedKinds.add('webp');
    }
  }

  if (buffer.slice(0, 5).toString('ascii') === '%PDF-') {
    detectedKinds.add('pdf');
  }

  if (hasSignature(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    detectedKinds.add('doc');
  }

  const isZipContainer = hasSignature(buffer, [0x50, 0x4b, 0x03, 0x04])
    || hasSignature(buffer, [0x50, 0x4b, 0x05, 0x06])
    || hasSignature(buffer, [0x50, 0x4b, 0x07, 0x08]);
  if (isZipContainer && bufferContainsText(buffer, '[Content_Types].xml') && bufferContainsText(buffer, 'word/')) {
    detectedKinds.add('docx');
  }

  if (isLikelyText(buffer)) {
    detectedKinds.add('txt');
    if (isSvgMarkup(buffer)) {
      detectedKinds.add('svg');
    }
  }

  return detectedKinds;
};

const ensureExtensionMatchesAllowedKinds = (file, allowedKinds, errorMessage) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = allowedKinds.flatMap((kind) => FILE_KIND_EXTENSIONS[kind] || []);

  if (!allowedExtensions.includes(extension)) {
    throw new Error(errorMessage);
  }
};

const ensureExtensionIsAllowed = (file, allowedExtensions, errorMessage) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    throw new Error(errorMessage);
  }
};

const ensureFileSignatureMatches = async (file, allowedKinds, errorMessage) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const sample = await readFileSample(file.path);
  let detectedKinds = detectFileKinds(sample);
  let hasValidKind = allowedKinds.some((kind) => detectedKinds.has(kind));

  if (!hasValidKind && extension === '.docx' && allowedKinds.includes('docx')) {
    // Some valid DOCX archives place their `word/` entries beyond the initial
    // signature sample window, so retry against the full file before rejecting.
    const fullBuffer = await fsPromises.readFile(file.path);
    detectedKinds = detectFileKinds(fullBuffer);
    hasValidKind = allowedKinds.some((kind) => detectedKinds.has(kind));
  }

  if (!hasValidKind) {
    throw new Error(errorMessage);
  }
};

const collectUploadedFiles = (req) => {
  if (req.file) {
    return [req.file];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat();
  }

  return [];
};

const buildInvalidTypeMessage = (allowedKinds) => (
  `Invalid file type. Uploaded content must be a valid ${allowedKinds.map((kind) => FILE_KIND_MESSAGES[kind]).join(', ')} file.`
);

const createValidatedUpload = ({ storage, limits, allowedKinds, allowedExtensions, mode, fields }) => {
  const multerInstance = multer({ storage, limits });
  let uploadMiddleware;

  if (mode === 'fields') {
    uploadMiddleware = multerInstance.fields(fields);
  } else if (mode === 'single') {
    uploadMiddleware = multerInstance.single(fields[0].name);
  } else {
    throw new Error(`Unsupported upload mode: ${mode}`);
  }

  // Extension-allowlist mode: validate by extension only. Used for uploads that
  // accept a broad set of binary formats with no reliable magic-byte signature
  // (creative/3D/media source files). Kind-based uploaders still enforce that the
  // file's actual content signature matches its extension.
  const useExtensionAllowlist = Array.isArray(allowedExtensions) && allowedExtensions.length > 0;
  const errorMessage = useExtensionAllowlist
    ? 'Invalid file type. This file format is not supported for uploads.'
    : buildInvalidTypeMessage(allowedKinds);

  return (req, res, next) => {
    uploadMiddleware(req, res, async (error) => {
      if (error) {
        return next(error);
      }

      const files = collectUploadedFiles(req);
      try {
        await Promise.all(files.map(async (file) => {
          if (useExtensionAllowlist) {
            ensureExtensionIsAllowed(file, allowedExtensions, errorMessage);
            return;
          }
          ensureExtensionMatchesAllowedKinds(file, allowedKinds, errorMessage);
          await ensureFileSignatureMatches(file, allowedKinds, errorMessage);
        }));
        next();
      } catch (validationError) {
        await Promise.all(files.map((file) => deleteUploadedFile(file.path)));
        next(validationError);
      }
    });
  };
};

// Creators upload lesson source assets in many creative/3D/media/document formats.
// These are validated by extension allowlist (see extension-allowlist mode above).
export const LESSON_ALLOWED_EXTENSIONS = [
  '.ma', '.mb', '.max', '.blend', '.c4d', '.hip', '.hiplc', '.hipnc', '.ztl', '.zpr',
  '.mud', '.spp', '.sbs', '.sbsar', '.psd', '.psb', '.ai', '.indd', '.aep', '.aepx',
  '.prproj', '.fla', '.xfl', '.sesx', '.lrcat', '.drp', '.dra', '.nk', '.comp', '.xstage',
  '.sbpz', '.sboard', '.tvpp', '.moho', '.anme', '.uproject', '.uasset', '.unity', '.zprj',
  '.ccproject', '.iproject', '.tbscene', '.rizomuv', '.mix', '.fbx', '.obj', '.abc', '.usd',
  '.usda', '.usdc', '.usdz', '.gltf', '.glb', '.dae', '.3ds', '.stl', '.ply', '.x3d', '.wrl',
  '.lwo', '.lws', '.step', '.stp', '.iges', '.igs', '.sat', '.dwg', '.dxf', '.svg', '.eps',
  '.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.tga', '.bmp', '.gif', '.webp', '.heic',
  '.ico', '.dds', '.ktx', '.exr', '.hdr', '.raw', '.cr2', '.cr3', '.nef', '.arw', '.orf',
  '.rw2', '.mp4', '.mov', '.avi', '.mxf', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.mpg',
  '.mpeg', '.3gp', '.wav', '.mp3', '.aiff', '.flac', '.ogg', '.aac', '.m4a', '.mid', '.midi',
  '.xml', '.json', '.csv', '.yaml', '.yml', '.txt', '.rtf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso',
];

export const uploadLessonFile = createValidatedUpload({
  storage: lessonStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  allowedExtensions: LESSON_ALLOWED_EXTENSIONS,
  mode: 'single',
  fields: [{ name: 'file' }],
});

export const uploadInstructorDocs = createValidatedUpload({
  storage: defaultStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  allowedKinds: ['pdf', 'doc', 'docx', 'jpeg', 'png'],
  mode: 'fields',
  fields: [
    { name: 'cvFile', maxCount: 1 },
    { name: 'courseMaterialsFile', maxCount: 1 },
  ],
});

export const uploadTeamMemberPhoto = createValidatedUpload({
  storage: teamMemberStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  allowedKinds: ['jpeg', 'png', 'gif', 'webp'],
  mode: 'single',
  fields: [{ name: 'image' }],
});

export const uploadPartnerLogo = createValidatedUpload({
  storage: partnerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  allowedKinds: ['jpeg', 'png', 'gif', 'webp', 'svg'],
  mode: 'single',
  fields: [{ name: 'image' }],
});

export const uploadAuthenticationLogo = createValidatedUpload({
  storage: authenticationStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  allowedKinds: ['jpeg', 'png', 'gif', 'webp', 'svg'],
  mode: 'single',
  fields: [{ name: 'image' }],
});
