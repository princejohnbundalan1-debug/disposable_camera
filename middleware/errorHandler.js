const multer = require('multer');

/**
 * Unified Global Error Handler
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

  const isApi = req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.includes('json');

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    let message = 'File upload error.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size is too large. Please upload files under the maximum limit.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded at once. Maximum is 10 files per batch.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected form field encountered.';
    }

    if (isApi) {
      return res.status(400).json({ success: false, message });
    }
    req.flash('error', message);
    return res.redirect('back');
  }

  // Handle custom application errors
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred. Please try again.';

  if (isApi) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
  }

  // Render pretty error page
  res.status(statusCode).render('partials/error', {
    title: `Error ${statusCode}`,
    message: statusCode === 500 && process.env.NODE_ENV !== 'development' 
      ? 'A server error occurred. Please try again later.' 
      : message,
    statusCode
  });
}

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  const isApi = req.originalUrl.startsWith('/api') || req.xhr || req.headers.accept?.includes('json');

  if (isApi) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }

  res.status(404).render('partials/error', {
    title: 'Page Not Found',
    message: 'The page or wedding event you are looking for does not exist or has moved.',
    statusCode: 404
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
