'use strict';

/** Redirect to login if no valid admin session exists. */
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) {
    return next();
  }
  res.redirect('/admin/login');
}

module.exports = { requireAdmin };
