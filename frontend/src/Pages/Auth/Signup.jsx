import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaCheck, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import { FaBriefcase, FaUserTie } from "react-icons/fa6";
import { authApi } from "../../lib/api/index";
import { showError } from "../../utils/toast";
import { validateEmail } from "../../utils/validation";
import LanguageSwitcher from "../../Components/LanguageSwitcher";
import { useI18n } from "../../lib/i18n";
import { useAuthStore } from "../../store/authStore";

const roleOptions = [
  {
    role: "candidate",
    title: "Candidate",
    description: "Apply for jobs and track interview updates.",
    icon: FaUserTie,
  },
  {
    role: "recruiter",
    title: "Recruiter",
    description: "Post roles and manage candidates.",
    icon: FaBriefcase,
  },
];

const roleTitleMap = {
  candidate: "Start applying with Job Tracker",
  recruiter: "Start hiring with Job Tracker",
};

const Signup = () => {
  const { t } = useI18n();
  const setAuth = useAuthStore((state) => state.setAuth);
  const location = useLocation();
  const validRoles = ["candidate", "recruiter"];
  const initialRole = validRoles.includes(location.state?.role) ? location.state.role : "candidate";
  const [userRole, setUserRole] = useState(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (password) => {
    const isValidLength = password.length >= 8;

    if (!isValidLength) {
      return "Password must be 8 or more characters.";
    }
    return "";
  };

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    const errorMessage = validateEmail(newEmail);
    setEmailError(errorMessage);
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    const errorMessage = validatePassword(newPassword);
    setPasswordError(errorMessage);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      const message = "All fields are required.";
      setFormError(message);
      showError(message);
      return;
    }

    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload = await authApi.signup({ name, email, password, role: userRole });
      setAuth(payload.user, payload.token);
      navigate(
        payload.user?.role === "recruiter" ? "/recruiter"
          : payload.user?.role === "hr_manager" ? "/hr-manager"
            : payload.user?.role === "interviewer" ? "/interviewer"
              : "/candidate"
      );
    } catch (error) {
      const message = error.message || "Failed to create account";
      setFormError(message);
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen blueprint-grid-bg px-4 py-8 text-[#0a0a0a]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[14px] border border-[#e5e5e5] bg-white shadow-[0_0_0_1px_rgba(10,10,10,0.1)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="blueprint-hero-panel hidden rounded-none border-0 border-r border-[#e5e5e5] p-10 text-[#0a0a0a] lg:flex lg:flex-col lg:justify-between">
          <Link to="/" className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-300 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black hover:scale-[1.02] transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </Link>

          <div className="relative z-10">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#e5e5e5] bg-white text-black">
              <FaBriefcase />
            </div>
            <h1 className="max-w-md text-[40px] font-semibold leading-none text-black">
              Choose the account that matches your workflow.
            </h1>

            <div className="mt-10 rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_0_0_1px_rgba(10,10,10,0.1)]">
              <div className="mb-4 flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <p className="text-xs font-medium uppercase text-[#737373]">Active Roles</p>
                  <p className="mt-1 text-sm font-medium text-black">Build your team</p>
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">2</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {roleOptions.map(({ role, title, icon: Icon }) => (
                  <div
                    key={role}
                    className={`rounded-[10px] border p-3 ${
                      userRole === role
                        ? "border-black bg-black text-white"
                        : "border-[#e5e5e5] bg-[#f2f2f2] text-[#0a0a0a]"
                    }`}
                  >
                    <Icon className="mb-3" size={18} />
                    <p className="text-xs font-medium">{title}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-sm text-[#737373]">
                <div className="h-2 w-full rounded-full bg-[#0a0a0a]" />
                <div className="h-2 w-4/5 rounded-full bg-[#e5e5e5]" />
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {[
                "Recruitment pipeline",
                "Onboarding checklist",
                "Employee and leave management",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[10px] border border-[#d4d4d4] bg-neutral-900 px-4 py-3 text-sm font-medium text-neutral-100 shadow-sm">
                  <FaCheckCircle className="shrink-0 text-white" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-lg">
            <div className="mb-8">
              <p className="text-xs font-medium uppercase text-[#737373]">{t("auth.createAccount")}</p>
              <h2 className="mt-2 text-[40px] font-semibold leading-none text-black">
                {roleTitleMap[userRole] || t("auth.signupCandidateTitle")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#737373]">
                {t("auth.signupSubtitle")}
              </p>
            </div>
            <div className="mb-6">
              <LanguageSwitcher />
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {roleOptions.map(({ role, title, description, icon: Icon }) => {
                const isSelected = userRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setUserRole(role);
                      setName("");
                      setFormError("");
                    }}
                    className={`rounded-[14px] border p-4 text-left transition ${
                      isSelected
                        ? "border-black bg-black text-white"
                        : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:-translate-y-0.5 hover:border-[#cfcfcf] hover:bg-[#f2f2f2]"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <Icon />
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? "border-white" : "border-[#e5e5e5]"}`}>
                        {isSelected && <FaCheck size={10} />}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className={`mt-1 text-xs leading-5 ${isSelected ? "text-white/70" : "text-[#737373]"}`}>
                      {description}
                    </p>
                  </button>
                );
              })}
            </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                {userRole === "recruiter" ? t("auth.companyName") : t("auth.name")}
              </label>
              <input
                type="text"
                id="name"
                placeholder={
                  userRole === "recruiter"
                    ? "Enter your company name...."
                    : "Enter your name...."
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-all placeholder:text-[#737373] focus:border-black focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                {t("auth.email")}
              </label>
              <input
                type="email"
                id="email"
                placeholder="youremail@gmail.com"
                value={email}
                onChange={handleEmailChange}
                required
                autoComplete="email"
                className="block w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-all placeholder:text-[#737373] focus:border-black focus:ring-2 focus:ring-black/10"
              />
              {emailError && (
                <p className="mt-2 text-sm text-[#c22b10]">{emailError}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Password (8 or more characters)"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="block w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2 pr-10 text-sm text-[#0a0a0a] outline-none transition-all placeholder:text-[#737373] focus:border-black focus:ring-2 focus:ring-black/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-[#737373] hover:text-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-2 text-sm text-[#c22b10]">{passwordError}</p>
              )}
            </div>
            {formError && (
              <div className="mt-2 rounded-[10px] border border-[#c22b10]/20 bg-[#c22b10]/5 px-3 py-2 text-sm text-[#c22b10]">
                {formError}
              </div>
            )}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="mb-2 flex w-full justify-center rounded-[10px] bg-black px-12 py-2.5 text-sm font-semibold text-white hover:bg-[#0a0a0a] disabled:opacity-60"
              >
                {isSubmitting ? t("auth.signingIn") : t("auth.createAccount")}
              </button>
              <p className="text-sm text-[#737373]">
                {t("auth.haveAccount")}{" "}
                <Link to="/login" className="font-medium text-black underline hover:no-underline">
                  {t("auth.login")}
                </Link>
              </p>
            </div>
          </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Signup;
