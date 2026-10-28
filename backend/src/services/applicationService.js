import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { applicationRepository } from "../repositories/applicationRepository.js";
import { analyzeApplication } from "./aiScreeningService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "../../uploads/cv");

fs.mkdirSync(uploadRoot, { recursive: true });

const allowedCvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const sanitizeCvFilename = (originalName = "cv.pdf") => {
  let fixed = originalName;
  try {
    fixed = Buffer.from(originalName, "latin1").toString("utf8");
  } catch {
    fixed = originalName;
  }

  const ext = path.extname(fixed) || ".pdf";
  const base = path.basename(fixed, ext);

  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "cv";

  return `${cleanBase}${ext.toLowerCase()}`;
};

export const getCleanDisplayName = (originalName = "cv.pdf") => {
  try {
    return Buffer.from(originalName, "latin1").toString("utf8");
  } catch {
    return originalName;
  }
};

export const uploadCv = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const safeName = sanitizeCvFilename(file.originalname);
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
  limits: {
    fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedCvMimeTypes.has(file.mimetype)) {
      cb(new Error("Only PDF, DOC and DOCX files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const applicationService = {
  getApplications: async (user) => {
    if (user.role === "candidate") {
      return await applicationRepository.findByCandidateId(user.id);
    }
    return await applicationRepository.findAll();
  },

  getRecruiterApplications: async (recruiterId, options) => {
    const applications = await applicationRepository.findForRecruiter(recruiterId, options);
    const total = await applicationRepository.countForRecruiter(recruiterId, options.jobPostId);
    
    const formatted = applications.map((row) => ({
      ...row,
      candidateName: row.candidate_name,
      candidateEmail: row.candidate_email,
      candidatePhone: row.candidate_phone,
      jobTitle: row.job_title,
      companyName: row.company_name,
      applicationDate: row.applied_at,
      aiScore: row.ai_score,
      aiRecommendation: row.ai_recommendation,
      aiSummary: row.ai_summary,
      aiStrengths: row.ai_strengths,
      aiWeaknesses: row.ai_weaknesses,
      aiScreenedAt: row.ai_screened_at,
    }));

    return {
      data: formatted,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit)
    };
  },

  getRecruiterActivity: async (recruiterId) => {
    return await applicationRepository.getRecruiterActivity(recruiterId);
  },

  getRecruiterAnalytics: async (recruiterId) => {
    const rows = await applicationRepository.getRecruiterAnalytics(recruiterId);
    return rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
  },

  getApplicationById: async (id) => {
    const application = await applicationRepository.findById(id);
    if (!application) throw new Error("Application not found");
    return application;
  },

  getApplicationForRecruiter: async (id, recruiterId) => {
    const application = await applicationRepository.findByIdForRecruiter(id, recruiterId);
    if (!application) throw new Error("Application not found");

    // Nếu hồ sơ chưa từng được AI phân tích, tự động kích hoạt phân tích ngay lập tức
    if (application.ai_score === null || application.ai_score === undefined) {
      if (application.cv_file_name || application.cv_file_path) {
        try {
          const aiResult = await analyzeApplication(application);
          await applicationRepository.updateAiScreening(id, aiResult);
          application.ai_score = aiResult.score;
          application.ai_recommendation = aiResult.recommendation;
          application.ai_summary = aiResult.summary;
          application.ai_strengths = aiResult.strengths;
          application.ai_weaknesses = aiResult.weaknesses;
          application.ai_screened_at = new Date();
        } catch (aiErr) {
          console.error(`Automatic on-the-fly AI screening error for app #${id}:`, aiErr.message);
        }
      }
    }

    return {
      ...application,
      candidateId: application.candidate_id,
      candidateName: application.candidate_name,
      candidateEmail: application.candidate_email,
      candidatePhone: application.candidate_phone,
      candidateSkills: application.candidate_skills,
      candidateExperience: application.candidate_experience,
      jobTitle: application.job_title,
      companyName: application.company_name,
      applicationDate: application.applied_at,
      cvFileName: application.cv_file_name,
      cvFilePath: application.cv_file_path,
      aiScore: application.ai_score,
      aiRecommendation: application.ai_recommendation,
      aiSummary: application.ai_summary,
      aiStrengths: application.ai_strengths,
      aiWeaknesses: application.ai_weaknesses,
      aiScreenedAt: application.ai_screened_at,
      notes: await applicationRepository.getNotes(id),
      events: await applicationRepository.getEvents(id),
    };
  },

  applyForJob: async (candidateId, { jobId, jobPostId, coverLetter }, cvFile) => {
    const normalizedJobPostId = jobPostId || jobId;
    const displayName = getCleanDisplayName(cvFile.originalname);
    const application = await applicationRepository.create(
      candidateId, 
      normalizedJobPostId, 
      {
        path: cvFile.path,
        name: displayName,
        mimetype: cvFile.mimetype,
        size: cvFile.size
      }, 
      coverLetter
    );

    await applicationRepository.addEvent(
      application.id,
      candidateId,
      "applied",
      "Job Applied",
      "Candidate submitted a new application"
    );

    // Tự động phân tích AI ngay khi nộp CV (Background AI Screening)
    try {
      const fullApplication = await applicationRepository.findById(application.id);
      if (fullApplication) {
        // Cho chạy không await để không làm chậm response của candidate
        analyzeApplication(fullApplication)
          .then((aiResult) => {
            return applicationRepository.updateAiScreening(application.id, aiResult);
          })
          .catch((aiErr) => {
            console.error(`Background AI screening failed for app #${application.id}:`, aiErr.message);
          });
      }
    } catch (bgErr) {
      console.error("Failed to trigger background AI screening:", bgErr.message);
    }

    return application;
  },

  update: async (id, candidateId, data) => {
    const application = await applicationRepository.update(id, candidateId, data);
    if (!application) throw new Error("Application not found");
    return application;
  },

  remove: async (id, candidateId) => {
    const removed = await applicationRepository.delete(id, candidateId);
    if (!removed) throw new Error("Application not found");
    return true;
  },

  updateStatus: async (id, status, actorId) => {
    const application = await applicationRepository.updateStatusForRecruiter(id, actorId, status);
    if (!application) throw new Error("Application not found");
    
    await applicationRepository.addEvent(
      id,
      actorId,
      "status_changed",
      "Status Updated",
      `Application status updated to ${status}`,
      { status }
    );

    return application;
  },

  reject: async (id, actorId, { reason, emailBody }) => {
    const application = await applicationRepository.rejectForRecruiter(id, actorId, reason, emailBody);
    if (!application) throw new Error("Application not found");

    await applicationRepository.addEvent(
      id,
      actorId,
      "rejected",
      "Application Rejected",
      reason,
      { reason }
    );

    return application;
  },

  offer: async (id, actorId) => {
    const application = await applicationRepository.updateStatusForRecruiter(id, actorId, "accepted");
    if (!application) throw new Error("Application not found");

    await applicationRepository.addEvent(
      id,
      actorId,
      "offer_sent",
      "Offer Sent",
      "Recruiter sent an offer to the candidate"
    );

    return application;
  },

  acceptOffer: async (id, actorId) => {
    const application = await applicationRepository.acceptOfferForCandidate(id, actorId);
    if (!application) throw new Error("Application not found");

    await applicationRepository.addEvent(
      id,
      actorId,
      "offer_accepted",
      "Offer Accepted",
      "Candidate accepted the offer"
    );

    return application;
  },

  declineOffer: async (id, actorId, reason) => {
    const application = await applicationRepository.declineOfferForCandidate(id, actorId, reason);
    if (!application) throw new Error("Application not found");

    await applicationRepository.addEvent(
      id,
      actorId,
      "offer_declined",
      "Offer Declined",
      reason || "Candidate declined the offer",
      { reason }
    );

    return application;
  },

  updateRating: async (id, rating, actorId) => {
    const application = await applicationRepository.updateRatingForRecruiter(id, actorId, rating);
    if (!application) throw new Error("Application not found");
    
    await applicationRepository.addEvent(
      id,
      actorId,
      "rating_updated",
      "Rating Updated",
      `Application rating updated to ${rating}`,
      { rating }
    );

    return application;
  },

  getNotes: async (applicationId, recruiterId) => {
    return await applicationRepository.getNotesForRecruiter(applicationId, recruiterId);
  },

  addNote: async (applicationId, recruiterId, note) => {
    const created = await applicationRepository.addNoteForRecruiter(applicationId, recruiterId, note);
    if (!created) throw new Error("Application not found");
    return created;
  },

  updateNote: async (noteId, recruiterId, note) => {
    const updated = await applicationRepository.updateNoteForRecruiter(noteId, recruiterId, note);
    if (!updated) throw new Error("Note not found");
    return updated;
  },

  deleteNote: async (noteId, recruiterId) => {
    const deleted = await applicationRepository.deleteNoteForRecruiter(noteId, recruiterId);
    if (!deleted) throw new Error("Note not found");
    return true;
  },

  getAiScreening: async (id, recruiterId) => {
    const application = await applicationRepository.findByIdForRecruiter(id, recruiterId);
    if (!application) throw new Error("Application not found");
    return await applicationRepository.getAiScreening(id);
  },

  analyzeAiScreening: async (id, recruiterId) => {
    const application = await applicationRepository.findByIdForRecruiter(id, recruiterId);
    if (!application) throw new Error("Application not found");
    const aiResult = await analyzeApplication(application);
    await applicationRepository.updateAiScreening(id, aiResult);
    return aiResult;
  },
};
