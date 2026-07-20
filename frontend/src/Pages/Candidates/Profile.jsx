/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MdAdd,
  MdBadge,
  MdCake,
  MdCameraAlt,
  MdCheck,
  MdCheckCircle,
  MdClose,
  MdEmail,
  MdErrorOutline,
  MdInfoOutline,
  MdLocationOn,
  MdOutlineEdit,
  MdPerson,
  MdPhone,
  MdWork,
} from "react-icons/md";
import { usersApi } from "../../lib/api/index";
import { calculateAge } from "../../utils/format";
import { showError, showSuccess } from "../../utils/toast";

const POPULAR_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Express",
  "PostgreSQL",
  "Python",
  "Java",
  "C#",
  "Docker",
  "Git",
  "REST API",
  "TailwindCSS",
  "SQL",
  "Figma",
];

const emptyProfile = {
  id: "",
  name: "",
  email: "",
  phone: "",
  location: "",
  dob: "",
  experience: "",
  jobType: "",
  skills: [],
  avatarFileName: "",
};

const normalizeDateForInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "Not updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not updated";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDraftKey = (profile) => (profile.id ? `candidate-profile-draft:${profile.id}` : "");

const FieldCard = ({ icon, label, value, children, editing = false }) => (
  <div className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_0_0_1px_rgba(10,10,10,0.04)] dark:border-neutral-800 dark:bg-neutral-950">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#737373] dark:text-neutral-400">
      <span className="text-[#0a0a0a] dark:text-white">{icon}</span>
      {label}
    </div>
    {editing ? (
      children
    ) : (
      <p className="min-h-[24px] break-words font-semibold text-[#0a0a0a] dark:text-white">
        {value || "Not updated"}
      </p>
    )}
  </div>
);

const ProfileSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="blueprint-hero-panel p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="h-24 w-24 rounded-[14px] bg-[#e5e5e5]" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-64 rounded-full bg-[#e5e5e5]" />
          <div className="h-4 w-80 max-w-full rounded-full bg-[#f2f2f2]" />
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-full bg-[#f2f2f2]" />
            <div className="h-8 w-28 rounded-full bg-[#f2f2f2]" />
          </div>
        </div>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="blueprint-card h-28 p-5" />
      ))}
    </div>
    <div className="blueprint-card h-72 p-6" />
  </div>
);

const CompletionChecklist = ({ items, nextSuggestion }) => (
  <div className="mt-4 space-y-2">
    {items.map((item) => (
      <div key={item.label} className="flex items-center gap-2 text-xs text-[#525252] dark:text-neutral-300">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full ${
            item.complete ? "bg-black text-white dark:bg-white dark:text-black" : "bg-gray-200 text-gray-800 dark:bg-neutral-800 dark:text-gray-300"
          }`}
        >
          {item.complete ? <MdCheck size={14} /> : "?"}
        </span>
        <span className={item.complete ? "font-semibold text-[#0a0a0a] dark:text-white" : ""}>{item.label}</span>
      </div>
    ))}
    {nextSuggestion && (
      <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-[#f7f7f7] p-3 text-xs leading-5 text-[#525252] dark:bg-neutral-900 dark:text-neutral-300">
        <MdInfoOutline className="mt-0.5 shrink-0 text-base" />
        <span>{nextSuggestion}</span>
      </div>
    )}
  </div>
);

const CandidateProfile = () => {
  const [profile, setProfile] = useState(emptyProfile);
  const [draft, setDraft] = useState(emptyProfile);
  const [editingSection, setEditingSection] = useState(null);
  const [newSkill, setNewSkill] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileInputRef = useRef(null);

  const completionItems = useMemo(
    () => [
      { label: "Name", complete: Boolean(profile.name) },
      { label: "Email", complete: Boolean(profile.email) },
      { label: "Phone", complete: Boolean(profile.phone) },
      { label: "Location", complete: Boolean(profile.location) },
      { label: "Date of birth", complete: Boolean(profile.dob) },
      { label: "Skills", complete: profile.skills.length > 0 },
      { label: "Experience", complete: Boolean(profile.experience) },
      { label: "Job preference", complete: Boolean(profile.jobType) },
    ],
    [profile]
  );

  const profileCompleteness = useMemo(() => {
    const completed = completionItems.filter((item) => item.complete).length;
    return Math.round((completed / completionItems.length) * 100);
  }, [completionItems]);

  const nextSuggestion = completionItems.find((item) => !item.complete)
    ? `Add ${completionItems.find((item) => !item.complete).label.toLowerCase()} to make your profile stronger.`
    : "Your profile is ready for recruiters to review.";

  const hasUnsavedChanges = useMemo(
    () => editingSection && JSON.stringify(draft) !== JSON.stringify(profile),
    [draft, editingSection, profile]
  );

  const skillSuggestions = useMemo(() => {
    const keyword = newSkill.trim().toLowerCase();
    if (!keyword) return POPULAR_SKILLS.filter((skill) => !draft.skills.includes(skill)).slice(0, 6);

    return POPULAR_SKILLS.filter(
      (skill) =>
        skill.toLowerCase().includes(keyword) &&
        !draft.skills.some((existingSkill) => existingSkill.toLowerCase() === skill.toLowerCase())
    ).slice(0, 6);
  }, [draft.skills, newSkill]);

  const age = calculateAge(profile.dob);

  const hydrateProfile = (payload) => {
    const nextProfile = {
      id: payload.id || "",
      name: payload.name || "",
      email: payload.email || "",
      phone: payload.phone || "",
      location: payload.location || payload.address || "",
      dob: normalizeDateForInput(payload.dob),
      experience: payload.experience || "",
      jobType: payload.job_type || payload.jobType || "",
      skills: Array.isArray(payload.skills) ? payload.skills.filter(Boolean) : [],
      avatarFileName: payload.avatarFileName || payload.avatar_file_name || "",
    };
    setProfile(nextProfile);
    setDraft(nextProfile);
  };

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const response = await usersApi.me();
        if (!mounted) return;
        hydrateProfile(response);
        setProfileError("");
      } catch (error) {
        if (!mounted) return;
        const message = error.message || "Failed to load profile";
        setProfileError(message);
        showError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile.avatarFileName) {
      setAvatarUrl("");
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    usersApi
      .getAvatarFile()
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => {
        if (active) setAvatarUrl("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile.avatarFileName]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const draftKey = getDraftKey(profile);
    if (!draftKey || !editingSection || !hasUnsavedChanges) return;
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, editingSection, hasUnsavedChanges, profile]);

  const saveProfile = async () => {
    try {
      setIsSaving(true);
      const updated = await usersApi.updateMe({
        name: draft.name,
        phone: draft.phone,
        location: draft.location,
        dob: draft.dob || null,
        experience: draft.experience,
        jobType: draft.jobType,
        skills: draft.skills,
      });
      hydrateProfile(updated);
      window.localStorage.removeItem(getDraftKey(profile));
      setEditingSection(null);
      setProfileError("");
      showSuccess("Profile saved successfully");
    } catch (error) {
      showError(error.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (section) => {
    const draftKey = getDraftKey(profile);
    const savedDraft = draftKey ? window.localStorage.getItem(draftKey) : null;

    if (savedDraft) {
      try {
        setDraft({ ...profile, ...JSON.parse(savedDraft) });
      } catch {
        setDraft(profile);
      }
    } else {
      setDraft(profile);
    }

    setNewSkill("");
    setEditingSection(section);
  };

  const cancelEditing = () => {
    if (hasUnsavedChanges && !window.confirm("Discard unsaved profile changes?")) {
      return;
    }

    setDraft(profile);
    setNewSkill("");
    setEditingSection(null);
  };

  const addSkillValue = (value) => {
    const nextSkills = value
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (nextSkills.length === 0) return;

    setDraft((current) => {
      const mergedSkills = [...current.skills];
      nextSkills.forEach((skill) => {
        if (!mergedSkills.some((existingSkill) => existingSkill.toLowerCase() === skill.toLowerCase())) {
          mergedSkills.push(skill);
        }
      });

      return { ...current, skills: mergedSkills };
    });
    setNewSkill("");
  };

  const removeSkill = (index) => {
    setDraft((current) => ({
      ...current,
      skills: current.skills.filter((_, skillIndex) => skillIndex !== index),
    }));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Please choose an image file.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);

    try {
      setIsUploadingAvatar(true);
      const updated = await usersApi.uploadAvatar(file);
      hydrateProfile(updated);
      showSuccess("Avatar updated successfully");
    } catch (error) {
      showError(error.message || "Failed to upload avatar");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsUploadingAvatar(false);
    }
  };

  const renderSectionAction = (section) =>
    editingSection === section ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cancelEditing}
          className="rounded-[10px] border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#0a0a0a] hover:bg-[#f2f2f2] dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveProfile}
          disabled={isSaving}
          className="blueprint-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => startEditing(section)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[#e5e5e5] px-4 py-2 text-sm font-semibold text-[#0a0a0a] hover:bg-[#f2f2f2] dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900"
      >
        <MdOutlineEdit size={18} />
        Edit
      </button>
    );

  return (
    <div className="min-h-screen bg-white px-4 pb-8 dark:bg-[#050505] sm:px-6 lg:px-8">
      <main className="mx-auto max-w-6xl space-y-6">
        {profileError && (
          <div className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <MdErrorOutline className="mt-0.5 text-lg" />
            <span>{profileError}</span>
          </div>
        )}

        {isLoading ? (
          <ProfileSkeleton />
        ) : (
          <>
            <section className="blueprint-hero-panel p-5 md:p-6">
              <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  <div className="relative h-24 w-24 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[14px] border border-[#e5e5e5] bg-black text-4xl font-semibold text-white shadow-sm"
                      aria-label="Upload avatar"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={profile.name || "Candidate avatar"} className="h-full w-full object-cover" />
                      ) : (
                        (profile.name || profile.email || "U").charAt(0).toUpperCase()
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-black shadow-sm hover:bg-[#f2f2f2] disabled:opacity-60"
                      aria-label="Change avatar"
                    >
                      <MdCameraAlt size={18} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </div>
                  <div>
                    <p className="blueprint-kicker">Candidate profile</p>
                    <h1 className="mt-1 text-3xl font-semibold text-black dark:text-white md:text-4xl">
                      {profile.name || "Candidate Name"}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#737373] dark:text-neutral-300">
                      Keep your contact information, skills, and job preferences ready before applying.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="blueprint-tag px-3 py-1 text-sm font-medium">
                        {profile.jobType || "Job type not set"}
                      </span>
                      <span className="blueprint-tag px-3 py-1 text-sm font-medium">{profile.skills.length} skills</span>
                      <span className="blueprint-tag px-3 py-1 text-sm font-medium">{profileCompleteness}% complete</span>
                      {isUploadingAvatar && <span className="blueprint-tag px-3 py-1 text-sm font-medium">Uploading avatar...</span>}
                    </div>
                  </div>
                </div>
                <div className="blueprint-card w-full p-4 md:w-72">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#0a0a0a] dark:text-white">Profile readiness</span>
                    <span className="blueprint-metric font-semibold">{profileCompleteness}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f2f2f2] dark:bg-neutral-800">
                    <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: `${profileCompleteness}%` }} />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#0a0a0a] dark:text-white">
                    Your profile is {profileCompleteness}% complete.
                  </p>
                  <CompletionChecklist items={completionItems} nextSuggestion={nextSuggestion} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <FieldCard icon={<MdEmail />} label="Email address" value={profile.email} />
              <FieldCard icon={<MdCake />} label="Date of birth" value={formatDate(profile.dob)} />
              <FieldCard icon={<MdBadge />} label="Age" value={age !== null ? `${age} years old` : "Not updated"} />
            </section>

            <section className="blueprint-card p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="blueprint-kicker">Personal details</p>
                  <h2 className="mt-1 text-xl font-semibold text-black dark:text-white">Contact and identity</h2>
                </div>
                {renderSectionAction("personal")}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldCard icon={<MdPerson />} label="Full name" value={profile.name} editing={editingSection === "personal"}>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    className="blueprint-input w-full px-3 py-2"
                    placeholder="Your full name"
                  />
                </FieldCard>
                <FieldCard icon={<MdPhone />} label="Phone number" value={profile.phone} editing={editingSection === "personal"}>
                  <input
                    value={draft.phone}
                    onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                    className="blueprint-input w-full px-3 py-2"
                    placeholder="Phone number"
                  />
                </FieldCard>
                <FieldCard icon={<MdLocationOn />} label="Location" value={profile.location} editing={editingSection === "personal"}>
                  <input
                    value={draft.location}
                    onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                    className="blueprint-input w-full px-3 py-2"
                    placeholder="City, country"
                  />
                </FieldCard>
                <FieldCard icon={<MdCake />} label="Date of birth" value={formatDate(profile.dob)} editing={editingSection === "personal"}>
                  <input
                    type="date"
                    value={draft.dob}
                    onChange={(event) => setDraft((current) => ({ ...current, dob: event.target.value }))}
                    className="blueprint-input w-full px-3 py-2"
                  />
                </FieldCard>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="blueprint-card p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="blueprint-kicker">Experience</p>
                    <h2 className="mt-1 text-xl font-semibold text-black dark:text-white">Professional summary</h2>
                  </div>
                  {renderSectionAction("experience")}
                </div>
                {editingSection === "experience" ? (
                  <textarea
                    rows={8}
                    value={draft.experience}
                    onChange={(event) => setDraft((current) => ({ ...current, experience: event.target.value }))}
                    className="blueprint-input w-full resize-none px-3 py-2"
                    placeholder="Summarize your recent work, strengths, and career focus..."
                  />
                ) : (
                  <div className="rounded-[14px] border border-[#e5e5e5] bg-[#f2f2f2] p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] bg-white text-black dark:bg-neutral-950 dark:text-white">
                      <MdWork size={22} />
                    </div>
                    <p className="whitespace-pre-line text-sm leading-6 text-[#0a0a0a] dark:text-neutral-100">
                      {profile.experience || "No experience summary added yet."}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="blueprint-card p-5 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="blueprint-kicker">Skills</p>
                      <h2 className="mt-1 text-xl font-semibold text-black dark:text-white">Core capabilities</h2>
                    </div>
                    {renderSectionAction("skills")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editingSection === "skills" ? draft.skills : profile.skills).map((skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-[#f2f2f2] px-3 py-1.5 text-sm font-semibold text-[#0a0a0a] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      >
                        {skill}
                        {editingSection === "skills" && (
                          <button
                            type="button"
                            onClick={() => removeSkill(index)}
                            className="rounded-full bg-white p-0.5 text-[#737373] hover:text-[#c22b10] dark:bg-neutral-950"
                            aria-label={`Remove ${skill}`}
                          >
                            <MdClose size={14} />
                          </button>
                        )}
                      </span>
                    ))}
                    {profile.skills.length === 0 && editingSection !== "skills" && (
                      <p className="text-sm text-[#737373] dark:text-neutral-400">No skills added yet.</p>
                    )}
                  </div>
                  {editingSection === "skills" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={newSkill}
                          onChange={(event) => setNewSkill(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addSkillValue(newSkill);
                            }
                          }}
                          className="blueprint-input min-w-0 flex-1 px-3 py-2"
                          placeholder="Add a skill, then press Enter"
                        />
                        <button
                          type="button"
                          onClick={() => addSkillValue(newSkill)}
                          className="inline-flex items-center gap-2 rounded-[10px] border border-[#e5e5e5] px-4 py-2 text-sm font-semibold hover:bg-[#f2f2f2] dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900"
                        >
                          <MdAdd size={18} />
                          Add
                        </button>
                      </div>
                      {skillSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {skillSuggestions.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => addSkillValue(skill)}
                              className="rounded-full border border-dashed border-[#cfcfcf] px-3 py-1 text-xs font-semibold text-[#525252] hover:border-black hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                            >
                              + {skill}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="blueprint-card p-5 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="blueprint-kicker">Preference</p>
                      <h2 className="mt-1 text-xl font-semibold text-black dark:text-white">Target role type</h2>
                    </div>
                    {renderSectionAction("preference")}
                  </div>
                  {editingSection === "preference" ? (
                    <input
                      value={draft.jobType}
                      onChange={(event) => setDraft((current) => ({ ...current, jobType: event.target.value }))}
                      className="blueprint-input w-full px-3 py-2"
                      placeholder="Full-time, remote, hybrid..."
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-[14px] border border-[#e5e5e5] bg-[#f2f2f2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-black dark:bg-neutral-950 dark:text-white">
                        <MdCheckCircle size={20} />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#737373] dark:text-neutral-400">Preferred job type</p>
                        <p className="font-semibold text-[#0a0a0a] dark:text-white">{profile.jobType || "Not updated"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default CandidateProfile;
