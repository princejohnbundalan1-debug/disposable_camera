const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

/**
 * Auth Controller
 */
class AuthController {
  /**
   * Render Login Page
   */
  getLogin(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/admin/dashboard');
    }
    res.render('auth/login', {
      title: 'Organizer Login | Wedding Moments',
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Render Register Page
   */
  getRegister(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/admin/dashboard');
    }
    res.render('auth/register', {
      title: 'Create Organizer Account | Wedding Moments',
      error: req.flash('error'),
      success: req.flash('success')
    });
  }

  /**
   * Handle Registration
   */
  async register(req, res) {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      req.flash('error', 'Please provide your name, email, and password.');
      return res.redirect('/auth/register');
    }

    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/auth/register');
    }

    try {
      // Check existing email
      const [existing] = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (existing && existing.length > 0) {
        req.flash('error', 'An account with that email already exists.');
        return res.redirect('/auth/register');
      }

      // Hash password with bcrypt
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Insert new user
      const [result] = await query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name.trim(), email.toLowerCase().trim(), passwordHash, 'organizer']
      );

      // Automatically log the user in
      req.session.user = {
        id: result.insertId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: 'organizer'
      };

      req.flash('success', 'Welcome! Your organizer account has been created.');
      return req.session.save((err) => {
        if (err) console.error('[Session Save Error]:', err);
        res.redirect('/admin/events/create');
      });
    } catch (error) {
      console.error('[AuthController] Register error:', error);
      req.flash('error', 'An unexpected error occurred during registration.');
      return res.redirect('/auth/register');
    }
  }

  /**
   * Handle Login
   */
  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error', 'Please enter your email and password.');
      return res.redirect('/auth/login');
    }

    try {
      const [rows] = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
      if (!rows || rows.length === 0) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      // Store in session
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      return req.session.save((err) => {
        if (err) console.error('[Session Save Error]:', err);
        res.redirect('/admin/dashboard');
      });
    } catch (error) {
      console.error('[AuthController] Login error:', error);
      req.flash('error', 'Could not process login. Please try again.');
      return res.redirect('/auth/login');
    }
  }

  /**
   * Handle Logout
   */
  logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[AuthController] Logout error:', err);
      }
      res.redirect('/auth/login');
    });
  }
}

module.exports = new AuthController();
