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

export const uploadCv = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeOriginalName}`);
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
    return {
      ...application,
      notes: await applicationRepository.getNotes(id),
      events: await applicationRepository.getEvents(id),
    };
  },

  applyForJob: async (candidateId, { jobId, jobPostId, coverLetter }, cvFile) => {
    const normalizedJobPostId = jobPostId || jobId;
    const application = await applicationRepository.create(
      candidateId, 
      normalizedJobPostId, 
      {
        path: cvFile.path,
        name: cvFile.originalname,
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
