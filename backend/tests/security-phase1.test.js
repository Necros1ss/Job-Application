import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/server.js";
import { pool } from "../src/config/db.js";

const createToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET || "fallback_secret_for_tests",
    { expiresIn: "1h" }
  );
};

describe("Phase 1 Security Remediation Tests", () => {
  let recruiterA, recruiterB, candidateA, candidateB;
  let jobA, jobB;
  let appA, appB;
  let tokenRecruiterA, tokenRecruiterB, tokenCandidateA, tokenCandidateB;

  beforeAll(async () => {
    // Generate isolated unique test records using transactions or unique timestamp
    const ts = Date.now();

    // 1. Create Recruiter A
    const resRecA = await pool.query(
      `INSERT INTO users (login_name, password_hash, role) VALUES ($1, 'hash', 'recruiter') RETURNING id`,
      [`rec_a_${ts}@test.com`]
    );
    recruiterA = { id: resRecA.rows[0].id, email: `rec_a_${ts}@test.com`, name: "Recruiter A", role: "recruiter" };
    await pool.query(`INSERT INTO recruiters (id, company_name, email) VALUES ($1, 'Company A', $2)`, [recruiterA.id, recruiterA.email]);
    tokenRecruiterA = createToken(recruiterA);

    // 2. Create Recruiter B
    const resRecB = await pool.query(
      `INSERT INTO users (login_name, password_hash, role) VALUES ($1, 'hash', 'recruiter') RETURNING id`,
      [`rec_b_${ts}@test.com`]
    );
    recruiterB = { id: resRecB.rows[0].id, email: `rec_b_${ts}@test.com`, name: "Recruiter B", role: "recruiter" };
    await pool.query(`INSERT INTO recruiters (id, company_name, email) VALUES ($1, 'Company B', $2)`, [recruiterB.id, recruiterB.email]);
    tokenRecruiterB = createToken(recruiterB);

    // 3. Create Candidate A
    const resCandA = await pool.query(
      `INSERT INTO users (login_name, password_hash, role) VALUES ($1, 'hash', 'candidate') RETURNING id`,
      [`cand_a_${ts}@test.com`]
    );
    candidateA = { id: resCandA.rows[0].id, email: `cand_a_${ts}@test.com`, name: "Candidate A", role: "candidate" };
    await pool.query(`INSERT INTO candidates (id, name, email) VALUES ($1, 'Candidate A', $2)`, [candidateA.id, candidateA.email]);
    tokenCandidateA = createToken(candidateA);

    // 4. Create Candidate B
    const resCandB = await pool.query(
      `INSERT INTO users (login_name, password_hash, role) VALUES ($1, 'hash', 'candidate') RETURNING id`,
      [`cand_b_${ts}@test.com`]
    );
    candidateB = { id: resCandB.rows[0].id, email: `cand_b_${ts}@test.com`, name: "Candidate B", role: "candidate" };
    await pool.query(`INSERT INTO candidates (id, name, email) VALUES ($1, 'Candidate B', $2)`, [candidateB.id, candidateB.email]);
    tokenCandidateB = createToken(candidateB);

    // 5. Create Job A (owned by Recruiter A) & Job B (owned by Recruiter B)
    const resJobA = await pool.query(
      `INSERT INTO job_posts (recruiter_id, title, status) VALUES ($1, 'Job A', 'active') RETURNING id`,
      [recruiterA.id]
    );
    jobA = resJobA.rows[0];

    const resJobB = await pool.query(
      `INSERT INTO job_posts (recruiter_id, title, status) VALUES ($1, 'Job B', 'active') RETURNING id`,
      [recruiterB.id]
    );
    jobB = resJobB.rows[0];

    // 6. Create Application A (Candidate A -> Job A) & Application B (Candidate B -> Job B)
    const resAppA = await pool.query(
      `INSERT INTO applications (candidate_id, job_post_id, status) VALUES ($1, $2, 'applied') RETURNING id, status`,
      [candidateA.id, jobA.id]
    );
    appA = resAppA.rows[0];

    const resAppB = await pool.query(
      `INSERT INTO applications (candidate_id, job_post_id, status) VALUES ($1, $2, 'applied') RETURNING id, status`,
      [candidateB.id, jobB.id]
    );
    appB = resAppB.rows[0];
  });

  afterAll(async () => {
    // Clean up created test data cleanly
    if (appA) await pool.query("DELETE FROM applications WHERE id = $1", [appA.id]);
    if (appB) await pool.query("DELETE FROM applications WHERE id = $1", [appB.id]);
    if (jobA) await pool.query("DELETE FROM job_posts WHERE id = $1", [jobA.id]);
    if (jobB) await pool.query("DELETE FROM job_posts WHERE id = $1", [jobB.id]);
    if (candidateA) await pool.query("DELETE FROM users WHERE id = $1", [candidateA.id]);
    if (candidateB) await pool.query("DELETE FROM users WHERE id = $1", [candidateB.id]);
    if (recruiterA) await pool.query("DELETE FROM users WHERE id = $1", [recruiterA.id]);
    if (recruiterB) await pool.query("DELETE FROM users WHERE id = $1", [recruiterB.id]);
    await pool.end();
  });

  it("1. Recruiter A can update status of application under own job", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appA.id}/status`)
      .set("Authorization", `Bearer ${tokenRecruiterA}`)
      .send({ status: "reviewed" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await pool.query("SELECT status FROM applications WHERE id = $1", [appA.id]);
    expect(check.rows[0].status).toBe("reviewed");
  });

  it("2. Recruiter A is FORBIDDEN from updating status of application under Recruiter B job (BOLA/IDOR)", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appB.id}/status`)
      .set("Authorization", `Bearer ${tokenRecruiterA}`)
      .send({ status: "reviewed" });

    expect(res.status).toBe(404);

    // Verify DB integrity: status of appB must NOT have changed
    const check = await pool.query("SELECT status FROM applications WHERE id = $1", [appB.id]);
    expect(check.rows[0].status).toBe("applied");
  });

  it("3. Recruiter A is FORBIDDEN from updating rating of Recruiter B application", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appB.id}/rating`)
      .set("Authorization", `Bearer ${tokenRecruiterA}`)
      .send({ rating: 5 });

    expect(res.status).toBe(404);

    const check = await pool.query("SELECT rating FROM applications WHERE id = $1", [appB.id]);
    expect(check.rows[0].rating).toBeNull();
  });

  it("4. Recruiter A is FORBIDDEN from scheduling interview for Recruiter B application", async () => {
    const res = await request(app)
      .post(`/api/interviews`)
      .set("Authorization", `Bearer ${tokenRecruiterA}`)
      .send({
        applicationId: appB.id,
        interviewDateTime: new Date(Date.now() + 86400000).toISOString(),
        interviewerName: "Interviewer Test",
        mode: "online"
      });

    expect(res.status).toBe(404);

    const check = await pool.query("SELECT id FROM interviews WHERE application_id = $1", [appB.id]);
    expect(check.rows.length).toBe(0);
  });

  it("5. Candidate A is FORBIDDEN from accepting Candidate B offer (IDOR)", async () => {
    const res = await request(app)
      .post(`/api/applications/${appB.id}/accept`)
      .set("Authorization", `Bearer ${tokenCandidateA}`);

    expect(res.status).toBe(404);

    const check = await pool.query("SELECT status FROM applications WHERE id = $1", [appB.id]);
    expect(check.rows[0].status).toBe("applied");
  });

  it("6. Candidate A can accept their own offer", async () => {
    const res = await request(app)
      .post(`/api/applications/${appA.id}/accept`)
      .set("Authorization", `Bearer ${tokenCandidateA}`);

    expect(res.status).toBe(200);

    const check = await pool.query("SELECT status FROM applications WHERE id = $1", [appA.id]);
    expect(check.rows[0].status).toBe("accepted");
  });

  it("7. Public signup with role 'hr_manager' is REJECTED", async () => {
    const res = await request(app)
      .post(`/api/auth/signup`)
      .send({
        name: "Malicious HR",
        email: "malicious_hr@test.com",
        password: "Password123!",
        role: "hr_manager"
      });

    expect(res.status).toBe(400);
  });

  it("8. Public signup with role 'interviewer' is REJECTED", async () => {
    const res = await request(app)
      .post(`/api/auth/signup`)
      .send({
        name: "Malicious Interviewer",
        email: "malicious_interviewer@test.com",
        password: "Password123!",
        role: "interviewer"
      });

    expect(res.status).toBe(400);
  });

  it("9. Public signup with role 'candidate' is ALLOWED", async () => {
    const res = await request(app)
      .post(`/api/auth/signup`)
      .send({
        name: "Legit Candidate",
        email: `legit_${Date.now()}@test.com`,
        password: "Password123!",
        role: "candidate"
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("candidate");
  });

  it("10. Unauthenticated request without token is REJECTED with 401", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appA.id}/status`)
      .send({ status: "accepted" });

    expect(res.status).toBe(401);
  });
});
