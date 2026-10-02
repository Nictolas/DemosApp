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

const corsPreflight = (req, res, next) => {
  const origin = req.headers.origin;
  const decision = evaluateCorsOrigin(origin);

  if (origin && decision.allowed) {
    res.header('Access-Control-Allow-Origin', origin);
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
  corsPreflight
};
