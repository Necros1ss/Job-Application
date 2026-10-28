import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
});

const DEFAULT_PASSWORD = "Password123";

const SAMPLE_JOBS = [
  {
    title: "Senior Fullstack NodeJS / React Developer",
    description: "Chúng tôi đang tìm kiếm Senior Fullstack Developer tham gia phát triển hệ thống nền tảng tuyển dụng và quản lý nhân sự quy mô lớn.",
    responsibilities: "- Thiết kế và xây dựng RESTful APIs hiệu năng cao bằng Express.js / Node.js\n- Phát triển giao diện người dùng hiện đại, responsive bằng ReactJS và Tailwind CSS\n- Tích hợp các dịch vụ AI (Gemini API) phục vụ tự động hóa quy trình tuyển dụng\n- Tối ưu hóa truy vấn PostgreSQL và cấu trúc cơ sở dữ liệu",
    requirements: "- Ít nhất 3 năm kinh nghiệm làm việc với Node.js, Express và React\n- Thành thạo PostgreSQL, thiết kế quan hệ và indexing\n- Có kinh nghiệm với Docker, Docker Compose và triển khai cloud (Render, Vercel)\n- Hiểu biết về tích hợp LLM / AI APIs là một lợi thế lớn",
    experience: "3+ years",
    location: "Ho Chi Minh City (Hybrid)",
    salary: "25,000,000 - 40,000,000 VND",
    employment_type: "full_time",
  },
  {
    title: "Junior Backend Developer (Node.js / Express)",
    description: "Cơ hội tuyệt vời cho các bạn lập trình viên trẻ đam mê backend, mong muốn học hỏi và phát triển hệ thống microservices và workflow automation.",
    responsibilities: "- Tham gia phát triển các tính năng backend theo kiến trúc MVC / Repository pattern\n- Viết tài liệu API chuẩn OpenAPI / Swagger\n- Viết unit test và tích hợp CI/CD cơ bản",
    requirements: "- Nắm vững JavaScript (ES6+), Node.js, Express.js\n- Nắm chắc kiến thức về RDBMS (PostgreSQL hoặc MySQL), viết query SQL tốt\n- Có tư duy logic tốt, tinh thần học hỏi cao, ưu tiên sinh viên năm cuối UIT/Bách Khoa",
    experience: "Entry - 1 year",
    location: "Ho Chi Minh City (On-site)",
    salary: "10,000,000 - 15,000,000 VND",
    employment_type: "full_time",
  },
  {
    title: "Frontend Engineer (React.js & Tailwind)",
    description: "Tham gia đội ngũ Frontend để kiến tạo trải nghiệm người dùng mượt mà, trực quan cho ứng dụng quản trị tuyển dụng và quản lý nhân sự.",
    responsibilities: "- Xây dựng dashboard tương tác, biểu đồ phân tích tuyển dụng và các pipeline kéo thả\n- Đảm bảo ứng dụng chạy mượt mà trên nhiều thiết bị và trình duyệt\n- Phối hợp chặt chẽ với team Backend để tích hợp API",
    requirements: "- Thành thạo ReactJS, React Hooks, Context API / Zustand\n- Sử dụng thành thạo Tailwind CSS và xử lý layout responsive\n- Có gu thẩm mỹ tốt, chú trọng chi tiết UI/UX",
    experience: "1-2 years",
    location: "Remote",
    salary: "15,000,000 - 22,000,000 VND",
    employment_type: "full_time",
  },
  {
    title: "DevOps & Cloud Intern",
    description: "Thực tập sinh vận hành hệ thống cloud, hỗ trợ tối ưu hóa quy trình triển khai tự động Docker và giám sát ứng dụng.",
    responsibilities: "- Hỗ trợ cấu hình Docker, Docker Compose cho các môi trường dev và staging\n- Thiết lập logging và monitoring\n- Tìm hiểu và triển khai hệ thống lên cloud Render / AWS",
    requirements: "- Hiểu cơ bản về Linux, Docker và Networking cơ bản\n- Có kiến thức nền tảng về Git, CI/CD\n- Nhiệt tình, ham học hỏi",
    experience: "No experience required",
    location: "Ho Chi Minh City",
    salary: "4,000,000 - 6,000,000 VND",
    employment_type: "internship",
  },
];

async function seedSampleData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("🌱 Bắt đầu tạo dữ liệu mẫu cho demo...");

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 1. Tạo Recruiter demo nếu chưa có
    const recruiterEmail = "recruiter.demo@example.com";
    const userRes = await client.query(
      `INSERT INTO users (login_name, password_hash, role)
       VALUES ($1, $2, 'recruiter')
       ON CONFLICT (login_name) DO UPDATE SET role = 'recruiter'
       RETURNING id`,
      [recruiterEmail, passwordHash]
    );
    const recruiterId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO recruiters (id, company_name, email, location, industry, company_description)
       VALUES ($1, 'TechNova Solutions', $2, 'Ho Chi Minh City', 'Software & IT', 'Công ty công nghệ hàng đầu chuyên cung cấp giải pháp nhân sự số hóa.')
       ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name`,
      [recruiterId, recruiterEmail]
    );

    // 2. Chèn các Job Posts mẫu
    let insertedJobsCount = 0;
    for (const job of SAMPLE_JOBS) {
      const checkJob = await client.query(
        "SELECT id FROM job_posts WHERE recruiter_id = $1 AND title = $2",
        [recruiterId, job.title]
      );

      if (checkJob.rows.length === 0) {
        await client.query(
          `INSERT INTO job_posts (
            recruiter_id, title, description, responsibilities, requirements,
            experience, location, salary, employment_type, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
          [
            recruiterId,
            job.title,
            job.description,
            job.responsibilities,
            job.requirements,
            job.experience,
            job.location,
            job.salary,
            job.employment_type,
          ]
        );
        insertedJobsCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`✅ Hoàn tất! Đã thêm ${insertedJobsCount} tin tuyển dụng mẫu.`);
    console.log(`🔑 Tài khoản Recruiter demo: ${recruiterEmail} / ${DEFAULT_PASSWORD}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi khi chèn dữ liệu mẫu:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSampleData();
