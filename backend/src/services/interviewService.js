import { pool } from "../config/db.js";
import { interviewRepository } from "../repositories/interviewRepository.js";
import { applicationRepository } from "../repositories/applicationRepository.js";
import { broadcast } from "../utils/notificationBroadcast.js";

export const interviewService = {
  getRecruiterInterviews: async (recruiterId, upcomingOnly) => {
    return await interviewRepository.findForRecruiter(recruiterId, upcomingOnly);
  },

  getCandidateInterviews: async (candidateId) => {
    return await interviewRepository.findForCandidate(candidateId);
  },

  getInterviewerInterviews: async (interviewerId, upcomingOnly) => {
    const rows = await interviewRepository.findForInterviewer(interviewerId, upcomingOnly);
    return rows.map((row) => ({
      id: row.id,
      applicationId: row.application_id,
      interviewDateTime: row.interview_datetime,
      mode: row.mode,
      meetLink: row.meet_link,
      location: row.location,
      notes: row.notes,
      interviewerName: row.interviewer_name,
      interviewerId: row.interviewer_id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      candidateEmail: row.candidate_email,
      candidatePhone: row.candidate_phone,
      jobPostId: row.job_post_id,
      jobTitle: row.job_title,
      companyName: row.company_name,
      evaluationRating: row.evaluation_rating,
      evaluationRecommendation: row.evaluation_recommendation,
    }));
  },

  scheduleInterview: async (recruiterId, data) => {
    const { applicationId, interviewDateTime, interviewerName, interviewerId, mode, meetLink, location, notes } = data;
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const application = await applicationRepository.findByIdForRecruiter(applicationId, recruiterId);
      if (!application) throw new Error("Application not found or permission denied");
      
      let finalInterviewerName = interviewerName;
      if (interviewerId) {
        const interviewer = await interviewRepository.checkInterviewerExists(interviewerId);
        if (!interviewer) throw new Error("Selected interviewer does not exist");
        finalInterviewerName = interviewer.name || interviewerName;
      }

      const interview = await interviewRepository.create(client, {
        application_id: applicationId,
        recruiter_id: recruiterId,
        interviewer_name: finalInterviewerName,
        interviewer_id: interviewerId,
        interview_datetime: interviewDateTime,
        mode,
        meet_link: meetLink,
        location,
        notes
      });

      await client.query(
        `INSERT INTO messages (sender_recruiter_id, receiver_candidate_id, subject, content, job_post_id, application_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [recruiterId, application.candidate_id, `Interview scheduled - ${application.job_title}`, notes, application.job_post_id, applicationId]
      );

      await applicationRepository.updateStatus(applicationId, 'scheduled_interview');

      await applicationRepository.addEvent(
        applicationId,
        recruiterId,
        "interview_scheduled",
        "Interview scheduled",
        notes,
        { interviewId: interview.id, interviewDateTime, mode }
      );

      await client.query("COMMIT");

      broadcast(application.candidate_id, "interview_scheduled", {
        id: `interview-${interview.id}`,
        title: "Interview scheduled",
        message: `Interview scheduled for ${application.job_title}.`,
        applicationId,
        interviewId: interview.id,
        jobPostId: application.job_post_id,
        jobTitle: application.job_title,
        interviewDateTime,
        mode,
        url: "/candidate/applications",
      });

      return {
        interview,
        application: { id: applicationId, status: "scheduled_interview" }
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  updateInterview: async (interviewId, recruiterId, data) => {
    const { interviewDateTime, interviewerName, interviewerId, mode, meetLink, location, notes } = data;
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const existing = await interviewRepository.findById(interviewId, recruiterId);
      if (!existing) throw new Error("Interview not found or permission denied");

      let finalInterviewerName = interviewerName;
      if (interviewerId) {
        const interviewer = await interviewRepository.checkInterviewerExists(interviewerId);
        if (!interviewer) throw new Error("Selected interviewer does not exist");
        finalInterviewerName = interviewer.name || interviewerName;
      }

      const updated = await interviewRepository.update(interviewId, recruiterId, {
        interviewer_name: finalInterviewerName,
        interviewer_id: interviewerId,
        interview_datetime: interviewDateTime,
        mode,
        meet_link: meetLink,
        location,
        notes
      });

      await applicationRepository.addEvent(
        existing.application_id,
        recruiterId,
        "interview_updated",
        "Interview updated",
        notes,
        { interviewId, interviewDateTime, mode }
      );

      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  deleteInterview: async (interviewId, recruiterId) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const interview = await interviewRepository.delete(interviewId, recruiterId);
      if (!interview) throw new Error("Interview not found or permission denied");

      await applicationRepository.addEvent(
        interview.application_id,
        recruiterId,
        "interview_cancelled",
        "Interview cancelled",
        interview.notes || "",
        { interviewId, interviewDateTime: interview.interview_datetime, mode: interview.mode }
      );

      const count = await interviewRepository.countInterviewsByApplication(interview.application_id);
      if (count === 0) {
        await pool.query(
          `UPDATE applications SET status = 'reviewed'
           WHERE id = $1 AND status = 'scheduled_interview'`,
          [interview.application_id]
        );
      }

      await client.query("COMMIT");
      return { id: interviewId, deleted: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  listInterviewers: async () => {
    const rows = await interviewRepository.findAllInterviewers();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      specialization: row.specialization,
      phone: row.phone,
      loginName: row.login_name,
    }));
  },

  submitEvaluation: async (interviewId, interviewerId, data) => {
    const { rating, strengths, weaknesses, notes, recommendation } = data;
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const interview = await interviewRepository.findById(interviewId);
      if (!interview || interview.interviewer_id !== interviewerId) {
        throw new Error("Interview not found or not assigned to you");
      }

      const evaluation = await interviewRepository.upsertEvaluation(client, {
        interview_id: interviewId,
        interviewer_id: interviewerId,
        rating,
        strengths,
        weaknesses,
        notes,
        recommendation
      });

      await applicationRepository.addEvent(
        interview.application_id,
        interviewerId,
        "evaluation_submitted",
        "Interview evaluation submitted",
        `Rating: ${rating}/5${recommendation ? `, Recommendation: ${recommendation}` : ""}`,
        { interviewId, rating, recommendation }
      );

      await client.query("COMMIT");
      return evaluation;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  getEvaluation: async (interviewId, role, userId) => {
    const hasAccess = await interviewRepository.checkAccess(interviewId, role, userId);
    if (!hasAccess) throw new Error("Evaluation not found or permission denied");
    
    return await interviewRepository.findEvaluationsByInterviewId(interviewId);
  },
};
