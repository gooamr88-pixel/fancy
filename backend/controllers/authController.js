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

    const userId = crypto.randomUUID();
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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes validity

    // 3. Save OTP details to organizations table
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        reset_otp: otp,
        reset_otp_expires_at: expiresAt
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

    // 2. Validate OTP value and expiration
    const storedOtp = org.reset_otp;
    const expiresAt = org.reset_otp_expires_at;

    if (!storedOtp || storedOtp !== otp || !expiresAt || new Date() > new Date(expiresAt)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'The OTP code is invalid or has expired.'
      });
    }

    // 3. Hash the new password and clear the OTP fields
    const passwordHash = hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        password_hash: passwordHash,
        reset_otp: null,
        reset_otp_expires_at: null
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

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};
