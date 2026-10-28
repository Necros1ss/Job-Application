import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../lib/api/index";
import { FaArrowLeft, FaBriefcase, FaCheckCircle, FaEye, FaEyeSlash } from "react-icons/fa";
import { showError } from "../../utils/toast";
import LanguageSwitcher from "../../Components/LanguageSwitcher";
import { useI18n } from "../../lib/i18n";
import { useAuthStore } from "../../store/authStore";

const Login = () => {
  const { t } = useI18n();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setFormError("All fields are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await authApi.login({ email, password });
      setAuth(payload.user, payload.token);
      setFormError("");
      navigate(
        payload.user?.role === "recruiter" ? "/recruiter"
          : payload.user?.role === "admin" ? "/admin"
            : payload.user?.role === "hr_manager" ? "/hr-manager"
              : payload.user?.role === "interviewer" ? "/interviewer"
                : "/candidate"
      );
    } catch (error) {
      const message = error.message || "Invalid email or password.";
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
            <h1 className="max-w-md text-[40px] font-semibold leading-none text-black">Run hiring and HR from one workspace.</h1>

            <div className="mt-10 rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_0_0_1px_rgba(10,10,10,0.1)]">
              <div className="mb-4 flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <p className="text-xs font-medium uppercase text-[#737373]">Pipeline</p>
                  <p className="mt-1 text-sm font-medium text-black">Frontend Engineer</p>
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">Live</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Applied", 4],
                  ["Interview", 2],
                  ["Offer", 1],
                ].map(([stage, count]) => (
                  <div key={stage} className="rounded-[10px] border border-[#e5e5e5] bg-[#f2f2f2] p-3">
                    <p className="text-[11px] font-medium uppercase text-[#737373]">{stage}</p>
                    <p className="mt-2 text-2xl font-semibold text-black">{count}</p>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 rounded-full bg-black" />
                      <div className="h-2 w-2/3 rounded-full bg-[#e5e5e5]" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[10px] border border-[#e5e5e5] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-2 w-28 rounded-full bg-black" />
                  <div className="h-6 w-16 rounded-full bg-[#f2f2f2]" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-[#e5e5e5]" />
                  <div className="h-2 w-5/6 rounded-full bg-[#e5e5e5]" />
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {["Recruitment pipeline", 
                "Onboarding checklist", 
                "Employee and leave management"
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[10px] border border-[#d4d4d4] bg-neutral-900 px-4 py-3 text-sm font-medium text-neutral-100 shadow-sm">
                  <FaCheckCircle className="shrink-0 text-white" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-8 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-[#737373] hover:bg-[#f2f2f2] hover:text-black lg:hidden">
              <FaArrowLeft /> Back to home
            </Link>
            <div className="mb-8">
              <p className="text-xs font-medium uppercase text-[#737373]">{t("auth.welcomeBack")}</p>
              <h2 className="mt-2 text-[40px] font-semibold leading-none text-black">{t("auth.loginTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-[#737373]">{t("auth.loginSubtitle")}</p>
            </div>
            <div className="mb-6">
              <LanguageSwitcher />
            </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                {t("auth.email")}
              </label>
              <input
                type="text"
                id="email"
                placeholder="youremail@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="block w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-all placeholder:text-[#737373] focus:border-black focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <span className="flex justify-between items-center">
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#0a0a0a]">
                  {t("auth.password")}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-[#737373] hover:text-black hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="***********"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="block w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2 pr-12 text-sm text-[#0a0a0a] outline-none transition-all placeholder:text-[#737373] focus:border-black focus:ring-2 focus:ring-black/10"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-4 text-[#737373] hover:text-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            {formError && (
              <div className="mt-2 rounded-[10px] border border-[#c22b10]/20 bg-[#c22b10]/5 px-3 py-2 text-sm text-[#c22b10]">{formError}</div>
            )}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full justify-center rounded-[10px] bg-black px-12 py-2.5 text-sm font-semibold text-white hover:bg-[#0a0a0a] disabled:opacity-60"
              >
                {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
              </button>
              <p className="mt-4 text-sm text-[#737373]">
                {t("auth.noAccount")}{" "}
                <Link to="/signup" className="font-medium text-black hover:underline">
                  {t("auth.createOne")}
                </Link>
              </p>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
