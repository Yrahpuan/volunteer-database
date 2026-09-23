const ERP_ERRORS = Object.freeze({
  401: {
    code: 'ERP_UNAUTHORIZED',
    message: 'Unable to authenticate with ERP',
  },
  404: {
    code: 'ERP_ACTIVITY_NOT_FOUND',
    message: 'Activity not found in ERP',
  },
  unavailable: {
    code: 'ERP_UNAVAILABLE',
    message: 'ERP service temporarily unavailable',
  },
});

class ErpIntegrationError extends Error {
  constructor({ code, message, httpStatus, cause }) {
    super(message, { cause });
    this.name = 'ErpIntegrationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }

  static fromStatus(status, cause) {
    const error = ERP_ERRORS[status] ?? ERP_ERRORS.unavailable;
    return new ErpIntegrationError({
      ...error,
      httpStatus: status === 401 ? 401 : status === 404 ? 404 : 503,
      cause,
    });
  }

  static unavailable(cause) {
    return new ErpIntegrationError({
      ...ERP_ERRORS.unavailable,
      httpStatus: 503,
      cause,
    });
  }
}

module.exports = { ErpIntegrationError };
