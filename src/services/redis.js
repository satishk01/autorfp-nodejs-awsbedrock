const { createClient } = require('redis');
const config = require('../config');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isEnabled = config.redis.url && config.redis.url !== 'disabled';
  }

  async initialize() {
    if (!this.isEnabled) {
      logger.info('Redis is disabled, using in-memory cache fallback');
      return;
    }

    try {
      this.client = createClient({
        url: config.redis.url,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection');
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          // Reconnect after
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('Redis service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isEnabled = false; // Fallback to in-memory cache
    }
  }

  // Cache operations
  async get(key) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.get(key);
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return this.memoryCache.get(key);
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.set(key, value, ttl);
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return this.memoryCache.set(key, value, ttl);
    }
  }

  async del(key) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.delete(key);
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return this.memoryCache.delete(key);
    }
  }

  async exists(key) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.has(key);
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return this.memoryCache.has(key);
    }
  }

  async keys(pattern) {
    if (!this.isEnabled || !this.isConnected) {
      return Array.from(this.memoryCache.keys()).filter(key => 
        key.includes(pattern.replace('*', ''))
      );
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error:', error);
      return [];
    }
  }

  async expire(key, ttl) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.expire(key, ttl);
    }

    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  // Hash operations
  async hget(key, field) {
    if (!this.isEnabled || !this.isConnected) {
      const hash = this.memoryCache.get(key);
      return hash ? hash[field] : null;
    }

    try {
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET error:', error);
      return null;
    }
  }

  async hset(key, field, value) {
    if (!this.isEnabled || !this.isConnected) {
      let hash = this.memoryCache.get(key) || {};
      hash[field] = value;
      return this.memoryCache.set(key, hash);
    }

    try {
      await this.client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis HSET error:', error);
      return false;
    }
  }

  async hgetall(key) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.get(key) || {};
    }

    try {
      const hash = await this.client.hGetAll(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error('Redis HGETALL error:', error);
      return {};
    }
  }

  // List operations
  async lpush(key, ...values) {
    if (!this.isEnabled || !this.isConnected) {
      let list = this.memoryCache.get(key) || [];
      list.unshift(...values);
      return this.memoryCache.set(key, list);
    }

    try {
      const serialized = values.map(v => JSON.stringify(v));
      await this.client.lPush(key, serialized);
      return true;
    } catch (error) {
      logger.error('Redis LPUSH error:', error);
      return false;
    }
  }

  async rpush(key, ...values) {
    if (!this.isEnabled || !this.isConnected) {
      let list = this.memoryCache.get(key) || [];
      list.push(...values);
      return this.memoryCache.set(key, list);
    }

    try {
      const serialized = values.map(v => JSON.stringify(v));
      await this.client.rPush(key, serialized);
      return true;
    } catch (error) {
      logger.error('Redis RPUSH error:', error);
      return false;
    }
  }

  async lrange(key, start, stop) {
    if (!this.isEnabled || !this.isConnected) {
      const list = this.memoryCache.get(key) || [];
      return list.slice(start, stop + 1);
    }

    try {
      const values = await this.client.lRange(key, start, stop);
      return values.map(v => JSON.parse(v));
    } catch (error) {
      logger.error('Redis LRANGE error:', error);
      return [];
    }
  }

  // Workflow-specific cache operations
  async cacheWorkflowResult(workflowId, stepName, result, ttl = 3600) {
    const key = `workflow:${workflowId}:${stepName}`;
    return await this.set(key, result, ttl);
  }

  async getCachedWorkflowResult(workflowId, stepName) {
    const key = `workflow:${workflowId}:${stepName}`;
    return await this.get(key);
  }

  async cacheDocumentContent(documentId, content, ttl = 7200) {
    const key = `document:${documentId}:content`;
    return await this.set(key, content, ttl);
  }

  async getCachedDocumentContent(documentId) {
    const key = `document:${documentId}:content`;
    return await this.get(key);
  }

  async cacheWorkflowProgress(workflowId, progress) {
    const key = `workflow:${workflowId}:progress`;
    return await this.set(key, progress, 300); // 5 minutes TTL
  }

  async getCachedWorkflowProgress(workflowId) {
    const key = `workflow:${workflowId}:progress`;
    return await this.get(key);
  }

  // Session management
  async setSession(sessionId, data, ttl = 86400) {
    const key = `session:${sessionId}`;
    return await this.set(key, data, ttl);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Rate limiting
  async checkRateLimit(identifier, limit, window) {
    const key = `rate_limit:${identifier}`;
    
    if (!this.isEnabled || !this.isConnected) {
      // Simple in-memory rate limiting
      const now = Date.now();
      const requests = this.memoryCache.get(key) || [];
      const validRequests = requests.filter(time => now - time < window * 1000);
      
      if (validRequests.length >= limit) {
        return { allowed: false, remaining: 0, resetTime: validRequests[0] + window * 1000 };
      }
      
      validRequests.push(now);
      this.memoryCache.set(key, validRequests, window);
      return { allowed: true, remaining: limit - validRequests.length, resetTime: now + window * 1000 };
    }

    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, window);
      }
      
      const ttl = await this.client.ttl(key);
      const resetTime = Date.now() + ttl * 1000;
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      };
    } catch (error) {
      logger.error('Redis rate limit error:', error);
      return { allowed: true, remaining: limit, resetTime: Date.now() + window * 1000 };
    }
  }

  // Statistics and monitoring
  async incrementCounter(key, increment = 1) {
    if (!this.isEnabled || !this.isConnected) {
      const current = this.memoryCache.get(key) || 0;
      this.memoryCache.set(key, current + increment);
      return current + increment;
    }

    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      logger.error('Redis INCRBY error:', error);
      return 0;
    }
  }

  async getCounter(key) {
    if (!this.isEnabled || !this.isConnected) {
      return this.memoryCache.get(key) || 0;
    }

    try {
      const value = await this.client.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      logger.error('Redis counter GET error:', error);
      return 0;
    }
  }

  // Cleanup operations
  async cleanup() {
    if (!this.isEnabled || !this.isConnected) {
      this.memoryCache.clear();
      return;
    }

    try {
      // Clean up expired workflow progress
      const progressKeys = await this.keys('workflow:*:progress');
      for (const key of progressKeys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.expire(key, 300); // Set 5 minute expiration
        }
      }

      logger.info('Redis cleanup completed');
    } catch (error) {
      logger.error('Redis cleanup error:', error);
    }
  }

  // Health check
  async healthCheck() {
    if (!this.isEnabled) {
      return { status: 'disabled', message: 'Redis is disabled, using memory cache' };
    }

    if (!this.isConnected) {
      return { status: 'disconnected', message: 'Redis client is not connected' };
    }

    try {
      await this.client.ping();
      return { status: 'healthy', message: 'Redis is connected and responsive' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  // Graceful shutdown
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      logger.info('Redis connection closed');
    }
  }

  // In-memory cache fallback
  memoryCache = new Map();
}

// Extend Map for in-memory cache with TTL support
class MemoryCache extends Map {
  constructor() {
    super();
    this.timers = new Map();
  }

  set(key, value, ttl = 0) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    super.set(key, value);

    // Set TTL timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }

    return true;
  }

  delete(key) {
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    return super.delete(key);
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    super.clear();
  }

  expire(key, ttl) {
    if (!this.has(key)) return false;

    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);
    this.timers.set(key, timer);

    return true;
  }
}

// Override memoryCache with enhanced version
RedisService.prototype.memoryCache = new MemoryCache();

// Create singleton instance
const redisService = new RedisService();

module.exports = redisService;