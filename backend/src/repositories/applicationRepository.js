import { pool } from "../config/db.js";

export const applicationRepository = {
  findAll: async () => {
    const result = await pool.query(
      `SELECT a.*, j.title as job_title, r.company_name
       FROM applications a
       JOIN job_posts j ON a.job_post_id = j.id
       JOIN recruiters r ON j.recruiter_id = r.id
       ORDER BY a.applied_at DESC`
    );
    return result.rows;
  },

  findByCandidateId: async (candidateId) => {
    const result = await pool.query(
      `SELECT a.*, j.title as job_title, r.company_name
       FROM applications a
       JOIN job_posts j ON a.job_post_id = j.id
       JOIN recruiters r ON j.recruiter_id = r.id
       WHERE a.candidate_id = $1
       ORDER BY a.applied_at DESC`,
      [candidateId]
    );
    return result.rows;
  },

  findForRecruiter: async (recruiterId, { page = 1, limit = 10, jobPostId } = {}) => {
    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*, c.name as candidate_name, c.email as candidate_email, j.title as job_title
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN job_posts j ON a.job_post_id = j.id
      WHERE j.recruiter_id = $1
    `;
    const params = [recruiterId];

    if (jobPostId) {
      query += ` AND a.job_post_id = $${params.length + 1}`;
      params.push(jobPostId);
    }

    query += ` ORDER BY a.applied_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  getRecruiterActivity: async (recruiterId, limit = 20) => {
    const result = await pool.query(
      `SELECT ae.*, a.id AS application_id, c.name AS candidate_name, j.title AS job_title
       FROM application_events ae
       JOIN applications a ON ae.application_id = a.id
       JOIN candidates c ON a.candidate_id = c.id
       JOIN job_posts j ON a.job_post_id = j.id
       WHERE j.recruiter_id = $1
       ORDER BY ae.created_at DESC
       LIMIT $2`,
      [recruiterId, limit]
    );
    return result.rows;
  },

  getRecruiterAnalytics: async (recruiterId) => {
    const result = await pool.query(
      `SELECT a.status, COUNT(*)::int AS count
       FROM applications a
       JOIN job_posts j ON a.job_post_id = j.id
       WHERE j.recruiter_id = $1
       GROUP BY a.status`,
      [recruiterId]
    );
    return result.rows;
  },

  countForRecruiter: async (recruiterId, jobPostId) => {
    let query = `
      SELECT COUNT(*) 
      FROM applications a
      JOIN job_posts j ON a.job_post_id = j.id
      WHERE j.recruiter_id = $1
    `;
    const params = [recruiterId];

    if (jobPostId) {
      query += ` AND a.job_post_id = $2`;
      params.push(jobPostId);
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count);
  },

  findById: async (id) => {
    const result = await pool.query(
      `SELECT a.*, c.name as candidate_name, c.email as candidate_email, j.title as job_title
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN job_posts j ON a.job_post_id = j.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  findByIdForRecruiter: async (id, recruiterId) => {
    const result = await pool.query(
      `SELECT
          a.*,
          c.name AS candidate_name,
          c.email AS candidate_email,
          c.phone AS candidate_phone,
          c.skills AS candidate_skills,
          c.experience AS candidate_experience,
          j.title AS job_title,
          j.description AS job_description,
          j.responsibilities AS job_responsibilities,
          j.requirements AS job_requirements,
          j.experience AS job_experience,
          j.employment_type,
          r.company_name
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN job_posts j ON a.job_post_id = j.id
       JOIN recruiters r ON j.recruiter_id = r.id
       WHERE a.id = $1 AND j.recruiter_id = $2`,
      [id, recruiterId]
    );
    return result.rows[0] || null;
  },

  create: async (candidateId, jobPostId, cvData, coverLetter) => {
    const result = await pool.query(
      `INSERT INTO applications (
        candidate_id, job_post_id, cover_letter,
        cv_file_path, cv_file_name, cv_mime_type, cv_file_size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        candidateId, jobPostId, coverLetter,
        cvData.path, cvData.name, cvData.mimetype, cvData.size
      ]
    );
    return result.rows[0];
  },

  update: async (id, candidateId, data) => {
    const result = await pool.query(
      `UPDATE applications
       SET cover_letter = COALESCE($1, cover_letter)
       WHERE id = $2 AND candidate_id = $3
       RETURNING *`,
      [data.coverLetter ?? data.cover_letter ?? null, id, candidateId]
    );
    return result.rows[0] || null;
  },

  delete: async (id, candidateId) => {
    const result = await pool.query(
      "DELETE FROM applications WHERE id = $1 AND candidate_id = $2 RETURNING id",
      [id, candidateId]
    );
    return result.rowCount > 0;
  },

  updateStatus: async (id, status) => {
    const result = await pool.query(
      "UPDATE applications SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return result.rows[0];
  },

  updateStatusForRecruiter: async (id, recruiterId, status) => {
    const result = await pool.query(
      `UPDATE applications a
       SET status = $1
       FROM job_posts jp
       WHERE a.job_post_id = jp.id
         AND a.id = $2
         AND jp.recruiter_id = $3
       RETURNING a.*`,
      [status, id, recruiterId]
    );
    return result.rows[0] || null;
  },

  reject: async (id, reason, emailBody) => {
    const result = await pool.query(
      `UPDATE applications
       SET status = 'rejected',
           rejection_reason = $1,
           rejection_email_body = $2
       WHERE id = $3
       RETURNING *`,
      [reason, emailBody, id]
    );
    return result.rows[0] || null;
  },

  rejectForRecruiter: async (id, recruiterId, reason, emailBody) => {
    const result = await pool.query(
      `UPDATE applications a
       SET status = 'rejected',
           rejection_reason = $1,
           rejection_email_body = $2
       FROM job_posts jp
       WHERE a.job_post_id = jp.id
         AND a.id = $3
         AND jp.recruiter_id = $4
       RETURNING a.*`,
      [reason, emailBody, id, recruiterId]
    );
    return result.rows[0] || null;
  },

  updateRating: async (id, rating) => {
    const result = await pool.query(
      "UPDATE applications SET rating = $1 WHERE id = $2 RETURNING *",
      [rating, id]
    );
    return result.rows[0];
  },

  updateRatingForRecruiter: async (id, recruiterId, rating) => {
    const result = await pool.query(
      `UPDATE applications a
       SET rating = $1
       FROM job_posts jp
       WHERE a.job_post_id = jp.id
         AND a.id = $2
         AND jp.recruiter_id = $3
       RETURNING a.*`,
      [rating, id, recruiterId]
    );
    return result.rows[0] || null;
  },

  acceptOfferForCandidate: async (id, candidateId) => {
    const result = await pool.query(
      `UPDATE applications
       SET status = 'accepted'
       WHERE id = $1 AND candidate_id = $2
       RETURNING *`,
      [id, candidateId]
    );
    return result.rows[0] || null;
  },

  declineOfferForCandidate: async (id, candidateId, reason) => {
    const result = await pool.query(
      `UPDATE applications
       SET status = 'rejected',
           rejection_reason = $1
       WHERE id = $2 AND candidate_id = $3
       RETURNING *`,
      [reason || "Candidate declined the offer", id, candidateId]
    );
    return result.rows[0] || null;
  },

  addEvent: async (applicationId, actorId, type, title, description, metadata = {}) => {
    await pool.query(
      `INSERT INTO application_events (application_id, actor_user_id, event_type, title, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [applicationId, actorId, type, title, description, metadata]
    );
  },

  getNotes: async (applicationId) => {
    const result = await pool.query(
      "SELECT * FROM application_notes WHERE application_id = $1 ORDER BY created_at DESC",
      [applicationId]
    );
    return result.rows;
  },

  getNotesForRecruiter: async (applicationId, recruiterId) => {
    const result = await pool.query(
      `SELECT an.*
       FROM application_notes an
       INNER JOIN applications a ON a.id = an.application_id
       INNER JOIN job_posts jp ON jp.id = a.job_post_id
       WHERE an.application_id = $1 AND jp.recruiter_id = $2
       ORDER BY an.created_at DESC`,
      [applicationId, recruiterId]
    );
    return result.rows;
  },

  addNote: async (applicationId, recruiterId, note) => {
    const result = await pool.query(
      "INSERT INTO application_notes (application_id, recruiter_id, note) VALUES ($1, $2, $3) RETURNING *",
      [applicationId, recruiterId, note]
    );
    return result.rows[0];
  },

  addNoteForRecruiter: async (applicationId, recruiterId, note) => {
    const result = await pool.query(
      `INSERT INTO application_notes (application_id, recruiter_id, note)
       SELECT $1, $2, $3
       WHERE EXISTS (
         SELECT 1 FROM applications a
         INNER JOIN job_posts jp ON jp.id = a.job_post_id
         WHERE a.id = $1 AND jp.recruiter_id = $2
       )
       RETURNING *`,
      [applicationId, recruiterId, note]
    );
    return result.rows[0] || null;
  },

  updateNote: async (noteId, note) => {
    const result = await pool.query(
      "UPDATE application_notes SET note = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [note, noteId]
    );
    return result.rows[0];
  },

  updateNoteForRecruiter: async (noteId, recruiterId, note) => {
    const result = await pool.query(
      `UPDATE application_notes an
       SET note = $1, updated_at = now()
       FROM applications a
       INNER JOIN job_posts jp ON jp.id = a.job_post_id
       WHERE an.id = $2
         AND an.application_id = a.id
         AND jp.recruiter_id = $3
       RETURNING an.*`,
      [note, noteId, recruiterId]
    );
    return result.rows[0] || null;
  },

  deleteNote: async (noteId) => {
    await pool.query("DELETE FROM application_notes WHERE id = $1", [noteId]);
  },

  deleteNoteForRecruiter: async (noteId, recruiterId) => {
    const result = await pool.query(
      `DELETE FROM application_notes an
       USING applications a, job_posts jp
       WHERE an.id = $1
         AND an.application_id = a.id
         AND a.job_post_id = jp.id
         AND jp.recruiter_id = $2
       RETURNING an.id`,
      [noteId, recruiterId]
    );
    return result.rowCount > 0;
  },

  getEvents: async (applicationId) => {
    const result = await pool.query(
      "SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at ASC",
      [applicationId]
    );
    return result.rows;
  },
};
