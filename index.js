const express = require('express');
const cors = require('cors');
require('dotenv').config();
const {
  newAnime,
  searchAnime,
  animeDetail,
  listAnime,
  jadwalAnime,
  fetchLatestDomain,
  getStreamLink,
  getBloggerVideo,
  getFiledonVideo
} = require('./animeAPI.js');

const app = express();
const PORT = process.env.PORT || 3000;
const prefix = '/api/v1/anime';
const router = express.Router();

const privatekey = process.env.API_KEY;


//CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// middleware API key
const API_ENABLED = process.env.API_ENABLED === 'true';
const API_MODE = process.env.API_MODE || 'public';
const API_KEY = process.env.API_KEY;

router.use((req, res, next) => {
  // 1️⃣ Global OFF
  if (!API_ENABLED) {
    return res.status(503).json({
      status: 503,
      message: 'API temporarily disabled'
    });
  }

  const apiKey = req.headers['x-api-key'];

  // 2️⃣ MODE PUBLIC → langsung lanjut
  if (API_MODE === 'public') {
    req.auth = { mode: 'public' };
    return next();
  }

  // 3️⃣ MODE PRIVATE → wajib key
  if (API_MODE === 'private') {
    if (!apiKey) {
      return res.status(401).json({
        status: 401,
        message: 'API key required'
      });
    }

    if (apiKey !== API_KEY) {
      return res.status(403).json({
        status: 403,
        message: 'Invalid API key'
      });
    }

    req.auth = { mode: 'private' };
    return next();
  }

  // 4️⃣ Kalau config salah
  return res.status(500).json({
    status: 500,
    message: 'Invalid API_MODE configuration'
  });
});


// ===== ROOT =====
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Anime API',
    status: 200,
    endpoints: [
      '/new-anime',
      '/search-anime?q=',
      '/anime-detail/:id',
      '/list-anime',
      '/jadwal-anime',
      '/latest-domain',
      '/get-stream-link?url=',
      '/get-blogger-video?url=',
      '/get-filedon-video?url='
    ]
  });
});

// ===== NEW ANIME =====
router.get('/new-anime', async (req, res) => {
  try {
    const data = await newAnime();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SEARCH =====
router.get('/search-anime', async (req, res) => {
  try {
    const data = await searchAnime(req.query.q || '');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DETAIL =====
router.get('/anime-detail/:animeUrl', async (req, res) => {
  try {
    const data = await animeDetail(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== LIST =====
router.get('/list-anime', async (req, res) => {
  try {
    const data = await listAnime();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== JADWAL =====
router.get('/jadwal-anime', async (req, res) => {
  try {
    const data = await jadwalAnime();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DOMAIN =====
router.get('/latest-domain', async (req, res) => {
  try {
    await fetchLatestDomain();
    res.json({ domain: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== STREAM HELPERS =====
router.get('/get-stream-link', async (req, res) => {
  try {
    const data = await getStreamLink(req.query.url || '');
    res.json({ streamLink: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get-blogger-video', async (req, res) => {
  try {
    const data = await getBloggerVideo(req.query.url || '');
    res.json({ videoLink: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get-filedon-video', async (req, res) => {
  try {
    const data = await getFiledonVideo(req.query.url || '');
    res.json({ videoLink: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// mount router
app.use(prefix, router);

// start server
app.listen(PORT, () => {
  console.log(`🚀 Anime API running at http://localhost:${PORT}${prefix}`);
});
