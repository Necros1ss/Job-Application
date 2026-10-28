import { request, requestBlob, buildQueryString } from "./client";

export const applicationsApi = {
  list: () => request("/applications"),
  listForRecruiter: async () => {
    const response = await request("/applications/recruiter");
    return Array.isArray(response) ? response : response.data || [];
  },
  listForRecruiterPaginated: ({ page = 1, limit = 10, jobPostId = "", sortBy = "applied_at", sortOrder = "desc" } = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (jobPostId && jobPostId !== "all") {
      params.set("jobPostId", String(jobPostId));
    }

    if (sortBy) {
      params.set("sortBy", String(sortBy));
    }
    if (sortOrder) {
      params.set("sortOrder", String(sortOrder));
    }

    return request(`/applications/recruiter?${params.toString()}`);
  },
  listRecruiterActivity: () => request("/applications/recruiter/activity"),
  getRecruiterAnalytics: (params = {}) => request(`/applications/recruiter/analytics${buildQueryString(params)}`),
  getForRecruiter: (id) => request(`/applications/recruiter/${id}`),
  getRecruiterCvFile: (id) => requestBlob(`/applications/recruiter/${id}/cv`),
  getAiScreening: (id) => request(`/applications/recruiter/${id}/ai-screen`),
  analyzeAiScreening: (id) =>
    request(`/applications/recruiter/${id}/ai-screen`, {
      method: "POST",
    }),
  update: (id, payload) =>
    request(`/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateStatus: (id, status) =>
    request(`/applications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  updateRating: (id, rating) =>
    request(`/applications/${id}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating }),
    }),
  addNote: (id, payload) =>
    request(`/applications/${id}/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateNote: (id, noteId, payload) =>
    request(`/applications/${id}/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteNote: (id, noteId) =>
    request(`/applications/${id}/notes/${noteId}`, {
      method: "DELETE",
    }),
  reject: (id, payload) =>
    request(`/applications/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  offer: (id, payload) =>
    request(`/applications/${id}/offer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  acceptOffer: (id) =>
    request(`/applications/${id}/accept-offer`, {
      method: "POST",
    }),
  declineOffer: (id, payload = {}) =>
    request(`/applications/${id}/decline-offer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id) =>
    request(`/applications/${id}`, {
      method: "DELETE",
    }),
};

export const applyFromJob = (jobId, cvFile, coverLetter = "") => {
  const normalizedJobId = Number(jobId);

  if (!Number.isInteger(normalizedJobId) || normalizedJobId <= 0) {
  throw new Error("Invalid jobId");
  }

  if (!(cvFile instanceof File)) {
    throw new Error("Invalid CV file");
  }

  const formData = new FormData();
  formData.append("jobId", String(normalizedJobId));
  formData.append("coverLetter", coverLetter);
  formData.append("cvFile", cvFile);

  return request("/applications/apply", {
    method: "POST",
    body: formData,
    });
};
