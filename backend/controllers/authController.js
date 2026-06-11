const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is required');

const CURRENT_ITERATIONS = 600000;
const LEGACY_ITERATIONS = 1000;

/**
 * Password strength regex: at least 8 chars, one uppercase, one lowercase, one digit.
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Hashes a password using async PBKDF2 with 600,000 iterations.
 */
const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, CURRENT_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};

/**
 * Verifies a password against a stored PBKDF2 hash.
 * Implements dual-hash migration: tries 600k iterations first, then falls back
 * to legacy 1,000 iterations. If legacy succeeds, rehashes with 600k and updates DB.
 * Uses crypto.timingSafeEqual for constant-time comparison.
 */
const verifyPassword = async (password, storedHash, orgEmail) => {
  if (!storedHash) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;

  const originalHashBuffer = Buffer.from(originalHash, 'hex');

  // Try current iterations (600,000) first
  const currentMatch = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, CURRENT_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(derivedKey, originalHashBuffer));
      } catch {
        resolve(false);
      }
    });
  });

  if (currentMatch) return true;

  // Fallback: try legacy iterations (1,000)
  const legacyMatch = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, LEGACY_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(derivedKey, originalHashBuffer));
      } catch {
        resolve(false);
      }
    });
  });

  if (legacyMatch && orgEmail) {
    // Rehash with current iterations and update DB
    try {
      const newHash = await hashPassword(password);
      await supabase
        .from('organizations')
        .update({ password_hash: newHash })
        .eq('email', orgEmail);
      console.log(`[Auth] Migrated password hash to ${CURRENT_ITERATIONS} iterations for ${orgEmail}`);
    } catch (rehashErr) {
      console.error('[Auth] Failed to rehash password during migration:', rehashErr.message);
    }
  }

  return legacyMatch;
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

  // Password strength validation
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ success: false, error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
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

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    
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
      .select('id, owner_user_id, name, email, phone, password_hash, failed_login_attempts, lockout_until')
      .eq('email', email)
      .limit(1);

    const org = orgs && orgs[0];

    // Check account lockout
    if (org && org.lockout_until && new Date(org.lockout_until) > new Date()) {
      const remainingMs = new Date(org.lockout_until) - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: `Account temporarily locked due to too many failed login attempts. Try again in ${remainingMin} minute(s).`
      });
    }

    if (!org || !(await verifyPassword(password, org.password_hash, email))) {
      // Increment failed attempts if org exists
      if (org) {
        const attempts = (org.failed_login_attempts || 0) + 1;
        const updateData = { failed_login_attempts: attempts };
        // Lock account after 5 failed attempts for 15 minutes
        if (attempts >= 5) {
          updateData.lockout_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          updateData.failed_login_attempts = 0; // Reset counter after lockout
        }
        await supabase
          .from('organizations')
          .update(updateData)
          .eq('email', email);
      }
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // Reset failed attempts on successful login
    if (org.failed_login_attempts > 0 || org.lockout_until) {
      await supabase
        .from('organizations')
        .update({ failed_login_attempts: 0, lockout_until: null })
        .eq('email', email);
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
      organization: {
        id: org.id,
        owner_user_id: org.owner_user_id,
        name: org.name,
        email: org.email,
        phone: org.phone
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handles password resets by generating and emailing a 6-digit OTP code.
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
    // 1. Resolve organization by email
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('email', email)
      .limit(1);

    if (fetchError) throw fetchError;

    const org = orgs && orgs[0];
    
    // If organization doesn't exist, return success anyway (prevent email enumeration vulnerability)
    if (!org) {
      console.log(`[Forgot Password] Requested email ${email} not found. Skipping OTP dispatch.`);
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset OTP code has been dispatched.'
      });
    }

    // 2. Generate 6-digit OTP code
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes validity

    // 3. Save hashed OTP to organizations table and reset otp_attempts counter
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        reset_otp: otpHash,
        reset_otp_expires_at: expiresAt,
        otp_attempts: 0
      })
      .eq('email', email);

    if (updateError) throw updateError;

    // 4. Send email containing OTP
    const { sendEmailViaBrevo } = require('../utils/notificationService');
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 12px; font-weight: bold; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.15em;">Password Recovery</span>
          <h2 style="color: #0b0f19; margin: 5px 0 0 0; font-family: Georgia, serif; font-weight: normal;">Fancy RSVP</h2>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;" />
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello ${org.name || 'Organizer'},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">You requested a password reset for your event organizer account. Use the following One-Time Password (OTP) to complete your verification. This code is valid for 15 minutes:</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #10b981; margin: 25px 0; font-family: monospace;">
          ${otp}
        </div>
        <p style="color: #ef4444; font-size: 14px; font-weight: bold;">Do not share this code with anyone.</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 25px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px; margin-bottom: 15px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">This is an automated security system notification from Fancy RSVP.</p>
      </div>
    `;

    const emailSent = await sendEmailViaBrevo(email, 'Password Reset Verification Code - Fancy RSVP', emailHtml);
    if (!emailSent) {
      throw new Error('Failed to dispatch password recovery email.');
    }

    return res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset OTP code has been dispatched.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Validates the reset OTP and updates the user's password.
 * POST /api/v1/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email, otp, newPassword, and confirmPassword are required.'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Passwords do not match.'
    });
  }

  // Password strength validation
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ success: false, error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
  }

  try {
    // 1. Fetch organization by email
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (fetchError) throw fetchError;

    const org = orgs && orgs[0];
    if (!org) {
      return res.status(400).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Invalid email or OTP code.'
      });
    }

    // 2. Check OTP attempt count (rate limiting)
    const otpAttempts = org.otp_attempts || 0;
    if (otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Too many attempts. Request a new OTP.'
      });
    }

    // 3. Validate OTP value and expiration
    const storedOtp = org.reset_otp;
    const expiresAt = org.reset_otp_expires_at;

    if (!storedOtp || !expiresAt || new Date() > new Date(expiresAt)) {
      // Increment OTP attempts on failure
      await supabase
        .from('organizations')
        .update({ otp_attempts: otpAttempts + 1 })
        .eq('email', email);

      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'The OTP code is invalid or has expired.'
      });
    }

    // Hash the submitted OTP and compare against stored hash (constant-time)
    const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpMatch = storedOtp.length === submittedHash.length &&
      crypto.timingSafeEqual(Buffer.from(storedOtp, 'utf8'), Buffer.from(submittedHash, 'utf8'));

    if (!otpMatch) {
      // Increment OTP attempts on failure
      await supabase
        .from('organizations')
        .update({ otp_attempts: otpAttempts + 1 })
        .eq('email', email);

      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'The OTP code is invalid or has expired.'
      });
    }

    // 4. Hash the new password and clear the OTP fields, reset attempts
    const passwordHash = await hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        password_hash: passwordHash,
        reset_otp: null,
        reset_otp_expires_at: null,
        otp_attempts: 0
      })
      .eq('email', email);

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches the authenticated user's organization profile.
 * GET /api/v1/auth/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, email, phone, created_at')
      .eq('owner_user_id', req.user.id)
      .single();

    if (error || !org) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Profile not found' });
    }

    res.json({ success: true, profile: org });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates the authenticated user's organization profile.
 * PATCH /api/v1/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'NO_UPDATES', message: 'No fields to update' });
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('owner_user_id', req.user.id)
      .select('id, name, email, phone')
      .single();

    if (error) throw error;

    res.json({ success: true, profile: org, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Changes the authenticated user's password after verifying the current one.
 * POST /api/v1/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Current and new passwords are required' });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
    }

    // Get current org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, email, password_hash')
      .eq('owner_user_id', req.user.id)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Profile not found' });
    }

    // Verify current password using the existing verifyPassword function
    const isValid = await verifyPassword(currentPassword, org.password_hash, org.email);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'WRONG_PASSWORD', message: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ password_hash: newHash })
      .eq('id', org.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword
};
