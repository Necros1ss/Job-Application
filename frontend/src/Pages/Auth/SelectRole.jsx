import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaBriefcase, FaCheck, FaUserTie } from "react-icons/fa";
import LanguageSwitcher from "../../Components/LanguageSwitcher";

const SelectRole = () => {
  // i18n removed - using English literals directly
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("candidate");

  const options = [
    {
      role: "candidate",
      title: "Candidate",
      headline: "Find work and track every application.",
      description: "Search jobs, apply with a cover letter, read recruiter messages, and follow onboarding tasks.",
      icon: FaUserTie,
    },
    {
      role: "recruiter",
      title: "Recruiter",
      headline: "Hire talent and manage the pipeline.",
      description: "Post roles, review candidates, schedule interviews, send offers, and start onboarding.",
      icon: FaBriefcase,
    },
  ];

  const handleContinue = () => {
    if (!selectedRole) {
      return;
    }

    navigate("/signup/create", { state: { role: selectedRole } });
  };

  return (
    <div className="min-h-screen blueprint-grid-bg px-4 py-8 text-[#0a0a0a]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[14px] border border-[#e5e5e5] bg-white shadow-[0_0_0_1px_rgba(10,10,10,0.1)] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="blueprint-hero-panel hidden rounded-none border-0 border-r border-[#e5e5e5] p-10 lg:flex lg:flex-col lg:justify-start lg:gap-10">
          <Link to="/" className="w-fit inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black hover:scale-[1.02] transition-all">
            <span className="inline-flex items-center gap-2">
              <FaArrowLeft size={12} />
              Back
            </span>
          </Link>

          <div className="relative z-10">
            <p className="text-xs font-medium uppercase text-[#737373]">Workspace setup</p>
            <h1 className="mt-3 max-w-md text-[40px] font-semibold leading-none text-black">
              One HR workspace, two focused starting points.
            </h1>

            <div className="mt-10 rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_0_0_1px_rgba(10,10,10,0.1)]">
              <div className="mb-4 flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <p className="text-xs font-medium uppercase text-[#737373]">Access map</p>
                  <p className="mt-1 text-sm font-medium text-black">Select role to personalize tools</p>
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">Step 1</span>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="space-y-3">
                  {["Profile", "Pipeline", "Messages"].map((item, index) => (
                    <div
                      key={item}
                      className={`rounded-[10px] border px-3 py-2 text-xs font-medium ${
                        index === 0
                          ? "border-black bg-black text-white"
                          : "border-[#e5e5e5] bg-[#f2f2f2] text-[#737373]"
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="rounded-[10px] border border-[#e5e5e5] bg-[#f2f2f2] p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-black" />
                    <div className="space-y-1">
                      <div className="h-2 w-24 rounded-full bg-black" />
                      <div className="h-2 w-16 rounded-full bg-[#e5e5e5]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[64, 40, 80].map((height) => (
                      <div key={height} className="flex h-20 items-end rounded-[10px] border border-[#e5e5e5] bg-white p-2">
                        <div className="w-full rounded-full bg-black" style={{ height }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-2xl">
            <div className="mb-8">
              <p className="text-xs font-medium uppercase text-[#737373]">Create account</p>
              <h2 className="mt-2 text-[40px] font-semibold leading-none text-black">
                Choose your role
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#737373]">
                Select the account type that matches what you want to do. You can continue into the signup form with the role already selected.
              </p>
            </div>
            <div className="mb-6">
              <LanguageSwitcher />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {options.map(({ role, title, headline, description, icon: Icon }) => {
                const isSelected = selectedRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`group rounded-[14px] border p-5 text-left transition ${
                      isSelected
                        ? "border-black bg-black text-white shadow-[0_0_0_1px_rgba(10,10,10,0.1)]"
                        : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:-translate-y-0.5 hover:border-[#cfcfcf] hover:bg-[#f2f2f2]"
                    }`}
                  >
                    <div className="mb-8 flex items-start justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] border ${
                        isSelected ? "border-white/20 bg-white text-black" : "border-[#e5e5e5] bg-[#f2f2f2] text-black"
                      }`}>
                        <Icon />
                      </div>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        isSelected ? "border-white bg-white text-black" : "border-[#a1a1a1] text-transparent"
                      }`}>
                        <FaCheck size={11} />
                      </span>
                    </div>
                    <p className="text-sm font-medium uppercase">{title}</p>
                    <h3 className="mt-3 text-xl font-semibold leading-tight">{headline}</h3>
                    <p className={`mt-3 text-sm leading-6 ${isSelected ? "text-white/70" : "text-[#737373]"}`}>
                      {description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-black px-12 py-2.5 text-sm font-semibold text-white hover:bg-[#0a0a0a]"
              >
                Create Account <FaArrowRight size={12} />
              </button>

              <p className="text-sm text-[#737373]">
                Already have an account? {" "}
                <Link to="/login" className="font-medium text-black underline hover:no-underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SelectRole;
