const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const romsDir = path.join(__dirname, 'roms');
const uploadsDir = path.join(__dirname, 'uploads');

[romsDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/roms', express.static(romsDir));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.gba' || ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .gba são permitidos'));
    }
  },
  limits: { fileSize: 64 * 1024 * 1024 }
});

app.get('/api/games', (req, res) => {
  try {
    const games = fs.readdirSync(romsDir)
      .filter(f => f.toLowerCase().endsWith('.gba'))
      .map(f => ({
        id: Buffer.from(f).toString('base64'),
        name: f.replace(/\.gba$/i, '').replace(/[-_]/g, ' '),
        file: f,
        url: `/roms/${encodeURIComponent(f)}`,
        source: 'library'
      }));
    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar jogos' });
  }
});

app.post('/api/upload', (req, res) => {
  upload.single('rom')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const originalName = req.file.originalname.replace(/\.gba$/i, '');
    res.json({
      name: originalName,
      url: `/uploads/${req.file.filename}`,
      source: 'upload'
    });
  });
});

app.delete('/api/upload/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Nome inválido' });
  }
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`GBA Online rodando em http://localhost:${PORT}`);
  console.log(`Adicione ROMs na pasta: ${romsDir}`);
});
