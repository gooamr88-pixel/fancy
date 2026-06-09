const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_for_authentication';

/**
 * Hashes a password using PBKDF2.
 */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

/**
 * Verifies a password against a stored PBKDF2 hash.
 */
const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};

/**
 * Registers a new organizer account.
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  const { email, password, name, orgName } = req.body;

  if (!email || !password || !name || !orgName) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email, password, name, and orgName are required.'
    });
  }

  try {
    // Check if user role exists
    const { data: existingUser } = await supabase
      .from('organizations')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'USER_EXISTS',
        message: 'A user with this email is already registered.'
      });
    }

    const userId = 'usr-' + Math.random().toString(36).substring(2, 9);
    const passwordHash = hashPassword(password);
    
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        owner_user_id: userId,
        name: orgName,
        email: email,
        password_hash: passwordHash
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create user role profile
    await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'organizer'
      });

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email, role: 'organizer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Organizer registered successfully.',
      token,
      user: { id: userId, email, name, role: 'organizer' },
      organization: org
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticates organizer login credentials.
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email and password are required.'
    });
  }

  try {
    // Resolve organization by email
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .eq('email', email)
      .limit(1);

    const org = orgs && orgs[0];
    if (!org || !verifyPassword(password, org.password_hash)) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    const userId = org.owner_user_id;

    // Resolve user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const role = roleData?.role || 'organizer';

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: userId, email, name: org.name, role },
      organization: org
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles password resets.
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email is required.'
    });
  }

  try {
    console.log(`[MOCK PASSWORD RESET] Reset link sent to: ${email}`);
    return res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been dispatched.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  forgotPassword
};
