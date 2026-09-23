import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDbPool, sql } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nexusai_fallback_secret_key';

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Name, Email, Password) are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const pool = await getDbPool();

    // Check if email already registered
    const existingUserResult = await pool
      .request()
      .input('email', sql.NVarChar, email.trim().toLowerCase())
      .query('SELECT id FROM Users WHERE LOWER(email) = LOWER(@email)');

    if (existingUserResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Securely hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into SQL Server
    const insertResult = await pool
      .request()
      .input('name', sql.NVarChar, name.trim())
      .input('email', sql.NVarChar, email.trim().toLowerCase())
      .input('password_hash', sql.NVarChar, passwordHash)
      .query(`
        INSERT INTO Users (name, email, password_hash)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
        VALUES (@name, @email, @password_hash)
      `);

    const newUser = insertResult.recordset[0];

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('[AuthController.register] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      error: error.message,
    });
  }
}

/**
 * Login existing user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const pool = await getDbPool();

    // Query user by email
    const userResult = await pool
      .request()
      .input('email', sql.NVarChar, email.trim().toLowerCase())
      .query('SELECT id, name, email, password_hash FROM Users WHERE LOWER(email) = LOWER(@email)');

    if (userResult.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = userResult.recordset[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[AuthController.login] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
      error: error.message,
    });
  }
}

/**
 * Logout
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export async function getCurrentUser(req, res) {
  try {
    const pool = await getDbPool();

    const userResult = await pool
      .request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, name, email FROM Users WHERE id = @id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const user = userResult.recordset[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[AuthController.getCurrentUser] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
      error: error.message,
    });
  }
}
