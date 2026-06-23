const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { escapeHtml } = require('../utils/emailTemplates');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { sendEmailViaBrevo } = require('../utils/notificationService');

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
      logger.info({ email: orgEmail }, 'Migrated password hash to current iteration count');
    } catch (rehashErr) {
      logger.error({ err: rehashErr }, 'Failed to rehash password during migration');
    }
  }

  return legacyMatch;
};

/**
 * Generates a signed JWT and attaches it as an httpOnly cookie.
 * Also returns the user/org data in the JSON body (WITHOUT the token).
 */
const issueAuthCookie = (res, payload) => {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  setAuthCookie(res, token);
  return token;
};

/**
 * Registers a new organizer account.
 * Creates the user in an UNVERIFIED state, generates 6-digit OTP, and dispatches email.
 * No auth cookie is issued until the OTP is verified via /verify-registration.
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  const { password, name, orgName } = req.body;
  // Normalize email to lowercase so registration and login resolve the same record.
  // (login() looks up by lowercased email; storing verbatim here would lock the user out.)
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

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

  // Normalize email so lookups match login/Google flows (all lowercase, trimmed)
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('organizations')
      .select('id, email_verified')
      .eq('email', normalizedEmail)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      // If already verified, reject
      if (existingUser[0].email_verified) {
        return res.status(409).json({
          success: false,
          error: 'USER_EXISTS',
          message: 'A user with this email is already registered.'
        });
      }
      // If unverified, allow re-registration (overwrite pending registration)
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    // Generate 6-digit OTP for email verification
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    if (existingUser && existingUser.length > 0) {
      // Update existing unverified record
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          owner_user_id: userId,
          name: orgName,
          password_hash: passwordHash,
          registration_otp: otpHash,
          registration_otp_expires_at: otpExpiresAt,
          otp_attempts: 0,
          email_verified: false,
        })
        .eq('email', normalizedEmail);
      if (updateError) throw updateError;
    } else {
      // Create new organization in unverified state
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          owner_user_id: userId,
          name: orgName,
          email: normalizedEmail,
          password_hash: passwordHash,
          registration_otp: otpHash,
          registration_otp_expires_at: otpExpiresAt,
          otp_attempts: 0,
          email_verified: false,
        });

      if (orgError) throw orgError;
    }

    // Create user role profile (upsert in case of re-registration)
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'organizer' }, { onConflict: 'user_id' });
    if (roleError) throw roleError;

    // Dispatch verification email via Brevo
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 12px; font-weight: bold; color: #B8944F; text-transform: uppercase; letter-spacing: 0.15em;">Email Verification</span>
          <h2 style="color: #0b0f19; margin: 5px 0 0 0; font-family: Georgia, serif; font-weight: normal;">Fancy RSVP</h2>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;" />
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello ${escapeHtml(name)},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Thank you for creating your Fancy RSVP account. Please enter the following verification code to activate your account:</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #10b981; margin: 25px 0; font-family: monospace;">
          ${otp}
        </div>
        <p style="color: #ef4444; font-size: 14px; font-weight: bold;">This code expires in 15 minutes.</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 25px;">If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 30px; margin-bottom: 15px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">This is an automated notification from Fancy RSVP.</p>
      </div>
    `;

    await sendEmailViaBrevo(normalizedEmail, 'Verify Your Email — Fancy RSVP', emailHtml);

    logger.info({ email: normalizedEmail }, 'Registration OTP dispatched');

    return res.status(201).json({
      success: true,
      message: 'Registration initiated. Please check your email for the verification code.',
      requiresVerification: true,
      email: normalizedEmail,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verifies the registration OTP and activates the account.
 * On success, issues the first httpOnly auth cookie.
 * POST /api/v1/auth/verify-registration
 */
const verifyRegistration = async (req, res, next) => {
  const { otp } = req.body;
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email and otp are required.'
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Fetch unverified organization
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, registration_otp, registration_otp_expires_at, otp_attempts, email_verified')
      .eq('email', normalizedEmail)
      .limit(1);

    if (fetchError) throw fetchError;

    const org = orgs && orgs[0];
    if (!org) {
      return res.status(400).json({ success: false, error: 'NOT_FOUND', message: 'No pending registration found for this email.' });
    }

    if (org.email_verified) {
      return res.status(400).json({ success: false, error: 'ALREADY_VERIFIED', message: 'This email is already verified. Please log in.' });
    }

    // 2. Rate limit OTP attempts
    const otpAttempts = org.otp_attempts || 0;
    if (otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Too many verification attempts. Please register again to receive a new code.'
      });
    }

    // 3. Validate OTP
    const storedOtp = org.registration_otp;
    const expiresAt = org.registration_otp_expires_at;

    if (!storedOtp || !expiresAt || new Date() > new Date(expiresAt)) {
      await supabase.from('organizations').update({ otp_attempts: otpAttempts + 1 }).eq('email', normalizedEmail);
      return res.status(400).json({ success: false, error: 'OTP_EXPIRED', message: 'The verification code has expired. Please register again.' });
    }

    const submittedHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const otpMatch = storedOtp.length === submittedHash.length &&
      crypto.timingSafeEqual(Buffer.from(storedOtp, 'utf8'), Buffer.from(submittedHash, 'utf8'));

    if (!otpMatch) {
      await supabase.from('organizations').update({ otp_attempts: otpAttempts + 1 }).eq('email', normalizedEmail);
      return res.status(400).json({ success: false, error: 'INVALID_OTP', message: 'Invalid verification code.' });
    }

    // 4. Activate the account
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        email_verified: true,
        registration_otp: null,
        registration_otp_expires_at: null,
        otp_attempts: 0,
      })
      .eq('email', normalizedEmail);

    if (updateError) throw updateError;

    // 5. Issue auth cookie
    const userId = org.owner_user_id;
    issueAuthCookie(res, { id: userId, email: normalizedEmail, role: 'organizer' });

    logger.info({ email: normalizedEmail }, 'Registration verified, account activated');

    return res.status(200).json({
      success: true,
      message: 'Email verified. Welcome to Fancy RSVP!',
      user: { id: userId, email: normalizedEmail, name: org.name, role: 'organizer' },
      organization: { id: org.id, owner_user_id: userId, name: org.name, email: org.email },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticates organizer login credentials.
 * Sets httpOnly auth cookie on success.
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

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
      .select('id, owner_user_id, name, email, phone, password_hash, failed_login_attempts, lockout_until, email_verified')
      .eq('email', normalizedEmail)
      .limit(1);

    const org = orgs && orgs[0];

    // Block unverified accounts
    if (org && org.email_verified === false) {
      return res.status(403).json({
        success: false,
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. Check your inbox for the verification code.'
      });
    }

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

    // Block Google-only accounts from password login
    if (org && !org.password_hash) {
      return res.status(400).json({
        success: false,
        error: 'GOOGLE_ACCOUNT',
        message: 'This account uses Google Sign-In. Please use the Google button to log in.'
      });
    }

    if (!org || !(await verifyPassword(password, org.password_hash, normalizedEmail))) {
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
          .eq('email', normalizedEmail);
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
        .eq('email', normalizedEmail);
    }

    const userId = org.owner_user_id;

    // Resolve user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const role = roleData?.role || 'organizer';

    // Issue httpOnly auth cookie
    issueAuthCookie(res, { id: userId, email: normalizedEmail, role });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: { id: userId, email: normalizedEmail, name: org.name, role },
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
 * Logs the user out by clearing the httpOnly auth cookie.
 * POST /api/v1/auth/logout
 */
const logout = (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

/**
 * Handles password resets by generating and emailing a 6-digit OTP code.
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'email is required.'
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Resolve organization by email
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('email', normalizedEmail)
      .limit(1);

    if (fetchError) throw fetchError;

    const org = orgs && orgs[0];
    
    // If organization doesn't exist, return success anyway (prevent email enumeration vulnerability)
    if (!org) {
      logger.info('Password reset requested');
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
      .eq('email', normalizedEmail);

    if (updateError) throw updateError;

    // 4. Send email containing OTP
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 12px; font-weight: bold; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.15em;">Password Recovery</span>
          <h2 style="color: #0b0f19; margin: 5px 0 0 0; font-family: Georgia, serif; font-weight: normal;">Fancy RSVP</h2>
        </div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;" />
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello ${escapeHtml(org.name || 'Organizer')},</p>
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

    const emailSent = await sendEmailViaBrevo(normalizedEmail, 'Password Reset Verification Code - Fancy RSVP', emailHtml);
    if (!emailSent) {
      throw new Error('Failed to dispatch password recovery email.');
    }

    logger.info({ email: normalizedEmail }, 'Password reset OTP dispatched');

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
  const { otp, newPassword, confirmPassword } = req.body;
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

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

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Fetch organization by email
    const { data: orgs, error: fetchError } = await supabase
      .from('organizations')
      .select('id, email, reset_otp, reset_otp_expires_at, otp_attempts, password_hash')
      .eq('email', normalizedEmail)
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
        .eq('email', normalizedEmail);

      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'The OTP code is invalid or has expired.'
      });
    }

    // Hash the submitted OTP and compare against stored hash (constant-time)
    const submittedHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const otpMatch = storedOtp.length === submittedHash.length &&
      crypto.timingSafeEqual(Buffer.from(storedOtp, 'utf8'), Buffer.from(submittedHash, 'utf8'));

    if (!otpMatch) {
      // Increment OTP attempts on failure
      await supabase
        .from('organizations')
        .update({ otp_attempts: otpAttempts + 1 })
        .eq('email', normalizedEmail);

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
      .eq('email', normalizedEmail);

    if (updateError) throw updateError;

    // Clear any existing auth cookie (force re-login with new password)
    clearAuthCookie(res);

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
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, error: 'SAME_PASSWORD', message: 'New password must be different from your current password.' });
    }
    const newHash = await hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ password_hash: newHash })
      .eq('id', org.id);

    if (updateError) throw updateError;

    // Re-issue auth cookie with fresh token after password change
    issueAuthCookie(res, { id: req.user.id, email: org.email, role: req.user.role });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticates via Google OAuth — works for ALL users, new and existing.
 *
 * Single "Continue with Google" entry point used by both the sign-in and
 * sign-up pages:
 *   - If the email already has an account → logs them in.
 *   - If the email is new → creates the account (no password, email auto-verified
 *     since Google already verified it) and logs them in.
 *   - If an unverified email/password registration exists → activates it and logs in.
 *
 * POST /api/v1/auth/google
 */
const googleAuth = async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Google credential is required.' });
  }

  try {
    // Verify Google token using google-auth-library (cryptographic verification)
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      return res.status(500).json({ success: false, error: 'CONFIG_ERROR', message: 'Google Sign-In is not configured on the server.' });
    }

    let googleData;
    try {
      const oAuth2Client = new OAuth2Client(expectedClientId);
      const ticket = await oAuth2Client.verifyIdToken({
        idToken: credential,
        audience: expectedClientId,
      });
      googleData = ticket.getPayload();
    } catch (tokenErr) {
      logger.warn({ error: tokenErr.message }, 'Google token verification failed');
      return res.status(401).json({ success: false, error: 'INVALID_TOKEN', message: 'Invalid or expired Google token.' });
    }

    if (!googleData.email_verified) {
      return res.status(400).json({ success: false, error: 'EMAIL_NOT_VERIFIED', message: 'Your Google email is not verified.' });
    }

    const email = googleData.email ? googleData.email.toLowerCase().trim() : '';
    if (!email) {
      return res.status(400).json({ success: false, error: 'NO_EMAIL', message: 'Could not retrieve your email from Google.' });
    }
    const name = googleData.name || googleData.given_name || 'User';

    // Look up an existing account by email
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, owner_user_id, name, email, phone, email_verified')
      .eq('email', email)
      .limit(1);

    let org = orgs && orgs[0];
    const isNewAccount = !org;

    if (org) {
      // Existing account → ensure it's verified (Google already verified the email)
      if (!org.email_verified) {
        await supabase
          .from('organizations')
          .update({ email_verified: true })
          .eq('email', email);
      }
    } else {
      // New account → create it with no password, email pre-verified
      const newUserId = crypto.randomUUID();
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          owner_user_id: newUserId,
          name,
          email,
          password_hash: null,
          email_verified: true,
        });
      if (orgError) throw orgError;

      // Re-fetch to pick up the DB-generated id
      const { data: created } = await supabase
        .from('organizations')
        .select('id, owner_user_id, name, email, phone')
        .eq('email', email)
        .single();
      org = created || { owner_user_id: newUserId, name, email };
    }

    const userId = org.owner_user_id;

    // Ensure the role profile exists (covers both new and legacy accounts)
    await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'organizer' }, { onConflict: 'user_id' });

    // Resolve the role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    const role = roleData?.role || 'organizer';

    // Issue auth cookie
    issueAuthCookie(res, { id: userId, email, role });

    logger.info({ email, isNewAccount }, 'Google authentication successful');

    return res.status(isNewAccount ? 201 : 200).json({
      success: true,
      message: isNewAccount ? 'Account created successfully via Google.' : 'Login successful.',
      user: { id: userId, email, name: org.name || name, role },
      organization: { id: org.id, owner_user_id: userId, name: org.name || name, email: org.email || email, phone: org.phone }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  verifyRegistration,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  googleAuth
};
