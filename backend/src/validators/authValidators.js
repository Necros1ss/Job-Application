import { z } from "zod";
import { USER_ROLES } from "../constants/roles.js";

const emailSchema = z.string().trim().toLowerCase().email("Please enter a valid email");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const trimmedName = z.string().trim().min(2, "Name is required");

export const signupSchema = z.object({
  body: z.object({
    name: trimmedName,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum([USER_ROLES.CANDIDATE, USER_ROLES.RECRUITER]).default(USER_ROLES.CANDIDATE),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema.optional().or(z.literal("")),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, "Token is required"),
    newPassword: passwordSchema,
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});
