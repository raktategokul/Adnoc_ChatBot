import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nexusai_fallback_secret_key';

// In-memory user store (zero database / zero SQL Server dependency)
// Persists for the lifetime of the server process
const users = new Map();

// Helper to seed default test/demo accounts
async function seedDefaultUsers() {
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('password123', salt);

  users.set('user@company.com', {
    id: 1,
    name: 'Gokul',
    email: 'user@company.com',
    password_hash: defaultPasswordHash,
    created_at: new Date(),
  });

  users.set('gokul@company.com', {
    id: 2,
    name: 'Gokul',
    email: 'gokul@company.com',
    password_hash: defaultPasswordHash,
    created_at: new Date(),
  });
}
seedDefaultUsers();

let nextUserId = 3;

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

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered in memory
    if (users.has(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Securely hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: nextUserId++,
      name: name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      created_at: new Date(),
    };

    users.set(normalizedEmail, newUser);

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

    const normalizedEmail = email.trim().toLowerCase();
    let user = users.get(normalizedEmail);

    // If user does not exist in memory, allow seamless fallback/auto-registration for prototype usability if needed
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

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
    const userId = req.user?.id;
    const userEmail = req.user?.email?.toLowerCase();

    // Look up by email or id
    let user = userEmail ? users.get(userEmail) : null;
    if (!user && userId) {
      for (const u of users.values()) {
        if (u.id === userId) {
          user = u;
          break;
        }
      }
    }

    // If user was signed with valid JWT token but memory restarted, reconstruct from JWT payload
    const userProfile = user || {
      id: req.user.id || 1,
      name: req.user.name || 'User',
      email: req.user.email || 'user@company.com',
    };

    return res.status(200).json({
      success: true,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
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
