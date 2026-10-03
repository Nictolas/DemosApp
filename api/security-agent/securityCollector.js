const { normalizeSecurityEvent } = require('./securityEvent');

class SecurityCollector {
  constructor({ maxBufferSize = 1000, sink = null } = {}) {
    if (!Number.isInteger(maxBufferSize) || maxBufferSize < 1 || maxBufferSize > 10000) {
      throw new Error('maxBufferSize must be an integer between 1 and 10000');
    }
    if (sink !== null && typeof sink !== 'function') {
      throw new TypeError('sink must be a function or null');
    }

    this.maxBufferSize = maxBufferSize;
    this.sink = sink;
    this.buffer = [];
  }

  async collect(input) {
    const event = normalizeSecurityEvent(input);
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.splice(0, this.buffer.length - this.maxBufferSize);
    }

    if (this.sink) {
      await this.sink(event);
    }

    return event;
  }

  snapshot() {
    return this.buffer.slice();
  }

  clear() {
    this.buffer.length = 0;
  }
}

module.exports = { SecurityCollector };
