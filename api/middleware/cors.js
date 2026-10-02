const cors = require('cors');
const { evaluateCorsOrigin } = require('../config/corsOriginPolicy');

const corsOptions = {
  origin(origin, callback) {
    const decision = evaluateCorsOrigin(origin);

    if (decision.allowed) {
      callback(null, true);
      return;
    }

    callback(new Error('Non autorizzato da CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Origin',
    'Accept',
    'X-Requested-With',
    'Cache-Control',
    'Pragma'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

const corsMiddleware = cors(corsOptions);

const setAllowedOriginHeader = (res, origin) => {
  switch (origin) {
    case 'https://www.demos.community':
      res.header('Access-Control-Allow-Origin', 'https://www.demos.community');
      return true;
    case 'https://demos.community':
      res.header('Access-Control-Allow-Origin', 'https://demos.community');
      return true;
    case 'https://demos-c7k0.onrender.com':
      res.header('Access-Control-Allow-Origin', 'https://demos-c7k0.onrender.com');
      return true;
    case 'http://localhost:3000':
      res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
      return true;
    case 'http://localhost:5173':
      res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
      return true;
    case 'http://127.0.0.1:3000':
      res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:3000');
      return true;
    case 'http://127.0.0.1:5173':
      res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
      return true;
    default:
      return false;
  }
};

const corsPreflight = (req, res, next) => {
  const origin = req.headers.origin;
  const decision = evaluateCorsOrigin(origin);

  if (origin && decision.allowed && setAllowedOriginHeader(res, origin)) {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  }

  next();
};

module.exports = {
  corsMiddleware,
  corsPreflight,
  setAllowedOriginHeader
};
