function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`
  });
}

function errorHandler(error, _req, res, _next) {
  res.status(error.statusCode || 500).json({
    message: error.message || 'Internal server error'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
