import { applicationService } from "../services/applicationService.js";
import { successResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const setNotFoundStatus = (error) => {
  if (error.message === "Application not found" || error.message.includes("not found")) {
    error.status = 404;
  }
  throw error;
};

export const listForCandidate = asyncHandler(async (req, res) => {
  const applications = await applicationService.getApplications(req.user);
  return res.json(successResponse(applications));
});

export const listForRecruiter = asyncHandler(async (req, res) => {
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    jobPostId: req.query.jobPostId
  };
  const result = await applicationService.getRecruiterApplications(req.user.id, options);
  return res.json(successResponse(result));
});

export const getActivity = asyncHandler(async (req, res) => {
  const activity = await applicationService.getRecruiterActivity(req.user.id);
  return res.json(successResponse(activity));
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await applicationService.getRecruiterAnalytics(req.user.id);
  return res.json(successResponse(analytics));
});

export const getForRecruiter = asyncHandler(async (req, res) => {
  const application = await applicationService
    .getApplicationForRecruiter(req.params.id, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application));
});

export const apply = asyncHandler(async (req, res) => {
  if (!req.file) {
    const error = new Error("CV file is required");
    error.status = 400;
    throw error;
  }
  const payload = req.validated?.body || req.body;
  const application = await applicationService.applyForJob(req.user.id, payload, req.file);
  return res.status(201).json(successResponse(application, "Application submitted successfully"));
});

export const update = asyncHandler(async (req, res) => {
  const application = await applicationService
    .update(req.params.id, req.user.id, req.body)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Application updated successfully"));
});

export const remove = asyncHandler(async (req, res) => {
  await applicationService.remove(req.params.id, req.user.id).catch(setNotFoundStatus);
  return res.status(204).send();
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.validated?.body || req.body;
  const application = await applicationService
    .updateStatus(req.params.id, status, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Status updated successfully"));
});

export const updateRating = asyncHandler(async (req, res) => {
  const { rating } = req.body;
  const application = await applicationService
    .updateRating(req.params.id, rating, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Rating updated successfully"));
});

export const addNote = asyncHandler(async (req, res) => {
  const { note: noteText } = req.validated?.body || req.body;
  const note = await applicationService.addNote(req.params.id, req.user.id, noteText);
  return res.status(201).json(successResponse(note, "Note added successfully"));
});

export const updateNote = asyncHandler(async (req, res) => {
  const note = await applicationService
    .updateNote(req.params.noteId, req.user.id, req.body.note)
    .catch(setNotFoundStatus);
  return res.json(successResponse(note, "Note updated successfully"));
});

export const deleteNote = asyncHandler(async (req, res) => {
  await applicationService
    .deleteNote(req.params.noteId, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(null, "Note deleted successfully"));
});

export const reject = asyncHandler(async (req, res) => {
  const payload = req.validated?.body || req.body;
  const application = await applicationService
    .reject(req.params.id, req.user.id, payload)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Application rejected successfully"));
});

export const offer = asyncHandler(async (req, res) => {
  const application = await applicationService
    .offer(req.params.id, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Offer sent successfully"));
});

export const acceptOffer = asyncHandler(async (req, res) => {
  const application = await applicationService
    .acceptOffer(req.params.id, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Offer accepted successfully"));
});

export const declineOffer = asyncHandler(async (req, res) => {
  const application = await applicationService
    .declineOffer(req.params.id, req.user.id, req.body?.reason)
    .catch(setNotFoundStatus);
  return res.json(successResponse(application, "Offer declined successfully"));
});

export const getAiScreening = asyncHandler(async (_req, res) => {
  const screening = await applicationService.getAiScreening();
  return res.json(successResponse(screening));
});

export const analyzeAiScreening = asyncHandler(async (req, res) => {
  const screening = await applicationService
    .analyzeAiScreening(req.params.id, req.user.id)
    .catch(setNotFoundStatus);
  return res.json(successResponse(screening, "AI screening completed successfully"));
});

export const downloadCv = asyncHandler(async (req, res) => {
  const application = await applicationService
    .getApplicationForRecruiter(req.params.id, req.user.id)
    .catch(setNotFoundStatus);

  if (!application.cv_file_path) {
    const error = new Error("CV file not found");
    error.status = 404;
    throw error;
  }

  return res.download(application.cv_file_path, application.cv_file_name || "cv");
});

export const getApplications = listForCandidate;
export const getRecruiterApplications = listForRecruiter;
export const getApplicationById = getForRecruiter;
export const applyForJob = apply;
export const getNotes = asyncHandler(async (req, res) => {
  const notes = await applicationService.getNotes(req.params.id, req.user.id);
  return res.json(successResponse(notes));
});
