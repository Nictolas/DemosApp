const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const AuditService = require('../../services/auditService');
const PrivacyDataExportService = require('../../services/privacyDataExportService');

const VALID_TYPES = new Set(['profile', 'opinions', 'activity', 'complete']);

/**
 * @route GET /api/user/download-data
 * @desc Scarica i dati personali dell'utente in JSON usando lo schema corrente.
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const type = String(req.query.type || 'complete').toLowerCase();

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({
      success: false,
      message: 'Tipo di dati non valido'
    });
  }

  try {
    const userData = await PrivacyDataExportService.buildExport(userId, type);

    await AuditService.logAction({
      userId,
      action: 'DATA_EXPORT',
      resource: 'user_data',
      details: {
        dataType: type,
        formatVersion: '2.0',
        timestamp: new Date().toISOString()
      }
    }).catch((auditError) => {
      console.warn('Audit DATA_EXPORT non disponibile:', auditError?.message || auditError);
    });

    const filename = `dati-${type}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    return res.json({
      success: true,
      data: userData,
      message: 'Dati esportati con successo'
    });
  } catch (error) {
    console.error('Errore durante l\'export dei dati:', error);

    await AuditService.logAction({
      userId,
      action: 'DATA_EXPORT_ERROR',
      resource: 'user_data',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }).catch(() => undefined);

    return res.status(500).json({
      success: false,
      message: 'Errore interno del server durante l\'export dei dati'
    });
  }
});

module.exports = router;
