// File: api/services/rateLimitService.js
const { pool } = require('../middleware/auth');

class RateLimitService {
  // Log delle violazioni di rate limiting
  static async logViolation(ip, endpoint, limitType, userAgent, userId = null) {
    try {
      const query = `
        INSERT INTO rate_limit_violations (
          ip_address, 
          endpoint, 
          limit_type, 
          user_agent, 
          user_id, 
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await pool.query(query, [ip, endpoint, limitType, userAgent, userId]);
      
      console.log(`📊 RATE LIMIT VIOLATION LOGGED: ${ip} - ${endpoint} - ${limitType}`);
    } catch (error) {
      console.error('❌ Errore nel logging violazione rate limit:', error);
    }
  }

  // Ottieni statistiche rate limiting
  static async getRateLimitStats(days = 7) {
    try {
      const query = `
        SELECT 
          limit_type,
          COUNT(*) as violation_count,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT user_id) as unique_users,
          DATE(timestamp) as violation_date
        FROM rate_limit_violations 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY limit_type, DATE(timestamp)
        ORDER BY violation_date DESC, violation_count DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche rate limit:', error);
      return [];
    }
  }

  // Ottieni IP sospetti
  static async getSuspiciousIPs(days = 7, minViolations = 5) {
    try {
      const query = `
        SELECT 
          ip_address,
          COUNT(*) as violation_count,
          COUNT(DISTINCT limit_type) as limit_types_violated,
          MAX(timestamp) as last_violation,
          STRING_AGG(DISTINCT limit_type, ', ') as violated_limits
        FROM rate_limit_violations 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY ip_address
        HAVING COUNT(*) >= $1
        ORDER BY violation_count DESC
      `;
      
      const result = await pool.query(query, [minViolations]);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero IP sospetti:', error);
      return [];
    }
  }

  // Ottieni statistiche per endpoint
  static async getEndpointStats(days = 7) {
    try {
      const query = `
        SELECT 
          endpoint,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN limit_type IS NOT NULL THEN 1 END) as violations,
          ROUND(
            (COUNT(CASE WHEN limit_type IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
            2
          ) as violation_percentage
        FROM rate_limit_violations 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY endpoint
        ORDER BY violations DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche endpoint:', error);
      return [];
    }
  }

  // RP-10 non approvata: blocco anche per chiamate dirette fuori dalla route Admin.
  static async cleanupOldViolations(_retentionDays = 30) {
    const error = new Error('RETENTION_POLICY_NOT_APPROVED');
    error.code = 'RETENTION_POLICY_NOT_APPROVED';
    error.statusCode = 409;
    throw error;
  }

  // Verifica se un IP è bloccato
  static async isIPBlocked(ip, hours = 24) {
    try {
      const query = `
        SELECT COUNT(*) as violation_count
        FROM rate_limit_violations 
        WHERE ip_address = $1 
        AND timestamp >= NOW() - INTERVAL '${hours} hours'
        AND limit_type IN ('auth', 'registration', 'password_reset')
      `;
      
      const result = await pool.query(query, [ip]);
      const violationCount = parseInt(result.rows[0].violation_count);
      
      // Blocca IP con più di 10 violazioni in 24 ore
      return violationCount > 10;
    } catch (error) {
      console.error('❌ Errore nella verifica blocco IP:', error);
      return false;
    }
  }

  // Ottieni dashboard rate limiting
  static async getDashboardData() {
    try {
      const [stats, suspiciousIPs, endpointStats] = await Promise.all([
        this.getRateLimitStats(7),
        this.getSuspiciousIPs(7, 3),
        this.getEndpointStats(7)
      ]);

      return {
        stats,
        suspiciousIPs,
        endpointStats,
        summary: {
          totalViolations: stats.reduce((sum, stat) => sum + parseInt(stat.violation_count), 0),
          uniqueIPs: new Set(stats.map(stat => stat.unique_ips)).size,
          uniqueUsers: new Set(stats.map(stat => stat.unique_users)).size,
          suspiciousIPCount: suspiciousIPs.length
        }
      };
    } catch (error) {
      console.error('❌ Errore nel recupero dashboard rate limiting:', error);
      return {
        stats: [],
        suspiciousIPs: [],
        endpointStats: [],
        summary: {
          totalViolations: 0,
          uniqueIPs: 0,
          uniqueUsers: 0,
          suspiciousIPCount: 0
        }
      };
    }
  }
}

module.exports = RateLimitService;
