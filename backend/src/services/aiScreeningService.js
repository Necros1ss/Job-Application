import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CV_UPLOAD_DIR = path.resolve(__dirname, "../../uploads/cv");
const MAX_CV_TEXT_CHARS = 45000;

const recommendationValues = ["strong_yes", "yes", "maybe", "no"];

const screeningSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    weaknesses: {
      type: "array",
      items: { type: "string" },
    },
    recommendation: {
      type: "string",
      enum: recommendationValues,
    },
    summary: { type: "string" },
  },
  required: ["score", "strengths", "weaknesses", "recommendation", "summary"],
  propertyOrdering: ["score", "recommendation", "summary", "strengths", "weaknesses"],
};

const createHttpError = (status, message, detail) => {
  const error = new Error(message);
  error.status = status;
  if (detail) {
    error.detail = detail;
  }
  return error;
};

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw createHttpError(
      503,
      "AI screening is not configured",
      "Set GEMINI_API_KEY in backend/.env and restart the backend."
    );
  }

  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
};

const resolveCvPath = (fileName, cvFilePath) => {
  // 1. Nếu có đường dẫn file trực tiếp và tồn tại trên disk
  if (cvFilePath) {
    const directPath = path.resolve(cvFilePath);
    try {
      const stat = fs.statSync?.(directPath) || true;
      return directPath;
    } catch {
      // Bỏ qua nếu không tồn tại trực tiếp
    }
  }

  // 2. Tìm trong thư mục upload CV
  const candidateName = fileName ? path.basename(fileName) : (cvFilePath ? path.basename(cvFilePath) : null);
  if (!candidateName) return null;

  const resolvedPath = path.resolve(CV_UPLOAD_DIR, candidateName);
  const uploadRoot = `${CV_UPLOAD_DIR}${path.sep}`;
  return resolvedPath.startsWith(uploadRoot) ? resolvedPath : null;
};

const normalizeText = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractCvText = async ({ fileName, cvFilePath, mimeType }) => {
  const filePath = resolveCvPath(fileName, cvFilePath);

  if (!filePath) {
    throw createHttpError(404, "CV file not found");
  }

  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (err) {
    throw createHttpError(404, `CV file could not be read: ${err.message}`);
  }
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const parsed = await parser.getText();
    return normalizeText(parsed.text).slice(0, MAX_CV_TEXT_CHARS);
  }

  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value).slice(0, MAX_CV_TEXT_CHARS);
  }

  throw createHttpError(
    415,
    "Unsupported CV format for AI screening",
    "AI screening currently supports PDF and DOCX files. Please ask the candidate to upload a PDF or DOCX CV."
  );
};

const buildPrompt = ({ application, cvText }) => {
  const candidateSkills = Array.isArray(application.candidate_skills)
    ? application.candidate_skills.join(", ")
    : application.candidate_skills || "";

  return `
Analyze this candidate for the job opening. Be evidence-based and concise.

Job:
- Title: ${application.job_title || "Unknown"}
- Company: ${application.company_name || "Unknown"}
- Employment type: ${application.employment_type || "Not specified"}
- Experience level: ${application.job_experience || "Not specified"}
- Description: ${application.job_description || "Not provided"}
- Responsibilities: ${application.job_responsibilities || "Not provided"}
- Requirements: ${application.job_requirements || "Not provided"}

Candidate:
- Name: ${application.candidate_name || "Unknown"}
- Email: ${application.candidate_email || "Unknown"}
- Phone: ${application.candidate_phone || "Unknown"}
- Skills from profile: ${candidateSkills || "Not provided"}
- Experience from profile: ${application.candidate_experience || "Not provided"}
- Cover letter: ${application.cover_letter || "Not provided"}

CV text:
${cvText}
`;
};

const parseScreeningResult = (response) => {
  const outputText = response.choices?.[0]?.message?.content;

  if (!outputText) {
    throw createHttpError(502, "AI provider returned an empty response");
  }

  const parsed = JSON.parse(outputText);
  const score = Number(parsed.score);
  const recommendation = String(parsed.recommendation || "");

  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100 ||
    !recommendationValues.includes(recommendation) ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.weaknesses) ||
    typeof parsed.summary !== "string"
  ) {
    throw createHttpError(502, "AI provider returned an invalid screening result");
  }

  return {
    score,
    strengths: parsed.strengths.map(String).filter(Boolean).slice(0, 6),
    weaknesses: parsed.weaknesses.map(String).filter(Boolean).slice(0, 6),
    recommendation,
    summary: parsed.summary.trim(),
  };
};

export const analyzeApplication = async (application) => {
  const fileName = application?.cv_file_name || (application?.cv_file_path ? path.basename(application.cv_file_path) : null);
  if (!fileName && !application?.cv_file_path) {
    throw createHttpError(400, "This application does not have a CV file");
  }

  const cvText = await extractCvText({
    fileName,
    cvFilePath: application.cv_file_path,
    mimeType: application.cv_mime_type,
  });

  if (!cvText) {
    throw createHttpError(422, "Could not extract readable text from this CV");
  }

  const genAI = getGeminiClient();
  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: screeningSchema,
    },
  });

  const result = await model.generateContent(buildPrompt({ application, cvText }));
  const response = await result.response;
  const outputText = response.text();

  if (!outputText) {
    throw createHttpError(502, "AI provider returned an empty response");
  }

  return {
    ...parseScreeningResult({ choices: [{ message: { content: outputText } }] }),
    model: modelName,
  };
};
