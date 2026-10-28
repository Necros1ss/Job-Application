import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { authRepository } from "../repositories/authRepository.js";
import { sendEmail } from "../utils/mailer.js";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "30d";

const createAccessToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

const createRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

const mapUser = (row) => ({
  id: row.id,
  role: row.role,
  name:
    row.role === "recruiter"
      ? row.recruiter_name || row.login_name
      : row.role === "hr_manager"
        ? row.hr_manager_name || row.login_name
        : row.role === "interviewer"
          ? row.interviewer_name || row.login_name
          : row.candidate_name || row.login_name,
  email:
    row.role === "recruiter"
      ? row.recruiter_email || row.login_name
      : row.role === "hr_manager"
        ? row.hr_manager_email || row.login_name
        : row.role === "interviewer"
          ? row.interviewer_email || row.login_name
          : row.candidate_email || row.login_name,
});

export const authService = {
  signup: async ({ name, email, password, role }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const displayName = name.trim();

    const ALLOWED_SIGNUP_ROLES = new Set(["candidate", "recruiter"]);
    if (!ALLOWED_SIGNUP_ROLES.has(role)) {
      const error = new Error("Invalid role for registration. Only candidate and recruiter are permitted.");
      error.status = 400;
      throw error;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const existingUser = await authRepository.findUserByLoginName(normalizedEmail);
      if (existingUser) {
        throw new Error("Email is already in use");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await authRepository.createUser(client, normalizedEmail, passwordHash, role);
      
      if (role === "candidate") {
        await authRepository.createCandidateProfile(client, newUser.id, displayName, normalizedEmail);
      } else if (role === "recruiter") {
        await authRepository.createRecruiterProfile(client, newUser.id, displayName, normalizedEmail);
      } else if (role === "hr_manager") {
        await authRepository.createHrManagerProfile(client, newUser.id, displayName, normalizedEmail);
      } else if (role === "interviewer") {
        await authRepository.createInterviewerProfile(client, newUser.id, displayName, normalizedEmail);
      }

      await client.query("COMMIT");
      
      const user = { id: newUser.id, role, name: displayName, email: normalizedEmail };
      return {
        accessToken: createAccessToken(user),
        refreshToken: createRefreshToken(user),
        user,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  login: async ({ email, password }) => {
    const loginName = email.trim().toLowerCase();
    const row = await authRepository.findUserByLoginName(loginName);

    if (!row) throw new Error("Invalid email or password");
    
    const isValidPassword = await bcrypt.compare(password, row.password_hash);
    if (!isValidPassword) throw new Error("Invalid email or password");

    if (row.is_deleted) throw new Error("Account has been removed");
    if (row.is_locked) throw new Error("Account is locked");

    const user = mapUser(row);
    return {
      accessToken: createAccessToken(user),
      refreshToken: createRefreshToken(user),
      user,
    };
  },

  refresh: async (refreshToken) => {
    if (!refreshToken) throw new Error("Session expired");

    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const profile = await authRepository.findUserById(payload.id);

      if (!profile) throw new Error("Session expired");

      const user = mapUser(profile);
      return {
        accessToken: createAccessToken(user),
        refreshToken: createRefreshToken(user),
        user,
      };
    } catch {
      throw new Error("Session expired");
    }
  },

  forgotPassword: async (email) => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return;

    const row = await authRepository.findUserByLoginName(normalizedEmail);
    if (!row) return;

    const user = mapUser(row);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await authRepository.createPasswordResetToken(user.id, token, expiresAt);

    const clientUrl = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const resetLink = `${clientUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

    await sendEmail(
      user.email,
      "Reset your password",
      `
        <p>You requested a password reset for your Job Application Management account.</p>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `
    );
  },

  resetPassword: async (token, newPassword) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const resetToken = await authRepository.findValidResetToken(token);
      if (!resetToken) {
        throw new Error("Invalid or expired reset token");
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await authRepository.updatePassword(resetToken.user_id, passwordHash);
      await authRepository.markTokenAsUsed(resetToken.id, client);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  changePassword: async (userId, currentPassword, newPassword) => {
    const row = await authRepository.findUserById(userId);
    if (!row) throw new Error("User not found");

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, row.password_hash);
    if (!isCurrentPasswordValid) throw new Error("Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await authRepository.updatePassword(userId, passwordHash);
  },
};
