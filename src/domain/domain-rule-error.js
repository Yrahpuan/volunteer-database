class DomainRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DomainRuleError';
    this.code = code;
  }
}

module.exports = { DomainRuleError };
