import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { FaPlus, FaList, FaThLarge, FaTrashAlt, FaCheck, FaTimes } from "react-icons/fa";
import { FaSearch } from "react-icons/fa";
import { useI18n } from "../../lib/i18n";
import { applicationsApi, savedJobsApi } from "../../lib/api/index";
import { SkeletonCard, SkeletonRow } from "../../Components/Skeleton";
import { showError, showSuccess } from "../../utils/toast";
import { formatDate } from "../../utils/format";
import {
  getApplicationDisplayStatus,
  getApplicationStatusLabel,
  isInterviewStatus,
  isOfferStatus,
} from "../../utils/applicationStatus";

const Applications = ({ initialTab = "all" }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [checkedJobIds, setCheckedJobIds] = useState([]);
  const [isCardView, setIsCardView] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedJobsLoading, setSavedJobsLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedOfferJob, setSelectedOfferJob] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [isResponding, setIsResponding] = useState(false);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const applications = await applicationsApi.list();
      setJobs(applications);
      setErrorMessage("");
    } catch (error) {
      const message = error.message || "Failed to load applications";
      setErrorMessage(message);
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedJobs = async () => {
    try {
      setSavedJobsLoading(true);
      const data = await savedJobsApi.list();
      setSavedJobs(data);
    } catch (error) {
      showError(error.message || "Failed to load saved jobs");
    } finally {
      setSavedJobsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    loadSavedJobs();
  }, []);

  const openJobDetail = (job) => {
    if (!job?.jobPostId) return;
    navigate(`/jobs/${job.jobPostId}`);
  };

  const handleCheckJob = (jobId) => {
    setCheckedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const deleteJob = async (jobToDelete) => {
    if (!jobToDelete || !jobToDelete.id) return;
    try {
      if (activeTab === "saved") {
        await savedJobsApi.remove(jobToDelete.id);
        setSavedJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
      } else {
        await applicationsApi.remove(jobToDelete.id);
        setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
        setCheckedJobIds((prev) => prev.filter((id) => id !== jobToDelete.id));
      } 
      setErrorMessage("");
      showSuccess(activeTab === "saved" ? "Saved job removed" : "Application deleted successfully");
    } catch (error) {
      const fallback = activeTab === "saved" ? "Failed to delete saved job" : "Failed to delete application";
      showError(error.message || fallback);
    }
  }

  const handleBulkDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete the selected jobs?");
    if (!confirmDelete) return;

    const results = await Promise.allSettled(
      checkedJobIds.map((jobId) => applicationsApi.remove(jobId))
    );

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      showError("Some applications could not be deleted. Please retry.");
      return;
    }

    setJobs((prev) => prev.filter((job) => !checkedJobIds.includes(job.id)));
    setCheckedJobIds([]);
    setErrorMessage("");
    showSuccess("Selected applications deleted successfully");
  };

  const openOfferModal = (job, e) => {
    if (e) e.stopPropagation();
    setSelectedOfferJob(job);
    setDeclineReason("");
    setShowOfferModal(true);
  };

  const handleAcceptOffer = async () => {
    if (!selectedOfferJob) return;
    const confirmed = window.confirm(t("candidate.confirmAccept", "Are you sure you want to accept this offer?"));
    if (!confirmed) return;

    setIsResponding(true);
    try {
      await applicationsApi.acceptOffer(selectedOfferJob.id);
      showSuccess(t("candidate.acceptSuccess", "Offer accepted successfully!"));
      setShowOfferModal(false);
      setSelectedOfferJob(null);
      loadJobs();
    } catch (err) {
      showError(err.message || "Failed to accept offer");
    } finally {
      setIsResponding(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!selectedOfferJob) return;

    setIsResponding(true);
    try {
      await applicationsApi.declineOffer(selectedOfferJob.id, { reason: declineReason });
      showSuccess(t("candidate.declineSuccess", "Offer declined successfully."));
      setShowOfferModal(false);
      setSelectedOfferJob(null);
      setDeclineReason("");
      loadJobs();
    } catch (err) {
      showError(err.message || "Failed to decline offer");
    } finally {
      setIsResponding(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const jobsToDisplay = activeTab === "saved" ? savedJobs : jobs;

  const visibleJobs = jobsToDisplay.filter((job) => {
      const displayStatus = getApplicationDisplayStatus(job.status);
      const matchesTab = activeTab === "all" || activeTab === "saved" || displayStatus === activeTab;    
      const matchesSearch =
      normalizedSearch.length === 0 || 
      job.jobTitle?.toLowerCase().includes(normalizedSearch) ||
      job.companyName?.toLowerCase().includes(normalizedSearch);

    return matchesTab && matchesSearch;
  });

  // Tính số lượng ứng tuyển đang ở vòng phỏng vấn
  const interviewCount = jobs.filter((job) => isInterviewStatus(job.status)).length;

  // Helper tạo màu cho Status Badge
  const getBadgeStyle = (status) => {
    const displayStatus = getApplicationDisplayStatus(status);
    if (isInterviewStatus(status)) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    if (displayStatus === 'applied') return 'bg-emerald-100 text-[#188155] dark:bg-emerald-950/50 dark:text-emerald-300';
    if (isOfferStatus(status)) return 'bg-[#188155] text-white';
    if (displayStatus === 'rejected') return 'bg-gray-200 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400';
    if (displayStatus === 'closed') return 'bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-300';
    return 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-6 pb-12">

        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">My Applications</h1>
            <p className="text-[var(--text-secondary)]">Track your journey across {jobs.length} open roles.</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/40 flex flex-col items-center md:items-end">
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Active Funnel</p>
            <p className="text-2xl font-bold text-[#188155] dark:text-emerald-400">
              {interviewCount < 10 ? `0${interviewCount}` : interviewCount} Interviews
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-100 dark:border-red-900/40" role="alert">
            {errorMessage}
          </p>
        )}

        {/* --- TABS BẰNG NÚT PILL (THAY THẾ KIỂU GẠCH CHÂN CŨ) --- */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["all", "applied", "interview", "offered", "rejected", "saved"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold capitalize transition-all ${
                activeTab === tab 
                  ? "bg-[#188155] text-white shadow-sm" 
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* --- THANH TÌM KIẾM & ĐỔI VIEW --- */}
        <div className="flex justify-between items-center mb-6">
          <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-4 py-2 w-full max-w-sm shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            <FaSearch className="text-[var(--text-secondary)] text-lg" />
            <input
              type="search"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-0"
            />
          </form>

          <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] p-1 rounded-lg shadow-sm">
            <button onClick={() => setIsCardView(true)} className={`p-2 rounded-md transition-colors ${isCardView ? "bg-[var(--bg-secondary)] text-[#188155] dark:text-emerald-400" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              <FaThLarge />
            </button>
            <button onClick={() => setIsCardView(false)} className={`p-2 rounded-md transition-colors ${!isCardView ? "bg-[var(--bg-secondary)] text-[#188155] dark:text-emerald-400" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              <FaList />
            </button>
          </div>
        </div>

        {(isLoading || savedJobsLoading) && isCardView && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {(isLoading || savedJobsLoading) && !isCardView && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
            {Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* ================== GRID VIEW (CARDS) ================== */}
        {!isLoading && !savedJobsLoading && isCardView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          
          {visibleJobs.map((job) => (
            <div
              key={job.id}
              className={`bg-[var(--bg-elevated)] rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[240px] transition-all hover:shadow-md cursor-pointer ${
                job.status?.toLowerCase() === 'offered' ? 'border-2 border-[#188155]' : 'border border-[var(--border-primary)]'
              }`}
              onClick={() => openJobDetail(job)}
            >
              {/* Card Header: Logo & Badge */}
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 bg-[#14233c] text-white rounded-xl flex items-center justify-center text-xs font-bold shrink-0">
                  {/* Thay thế bằng ảnh Logo nếu có: <img src={job.logo} ... /> */}
                  LOGO
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${getBadgeStyle(job.status)}`}>
                  {getApplicationStatusLabel(job.status)}
                </span>
              </div>

              {/* Card Body: Info */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-[var(--text-primary)] truncate">{job.jobTitle}</h3>
                <p className="text-sm text-[var(--text-secondary)] truncate">{job.companyName} • {job.location || "Remote"}</p>
              </div>

              {/* Card Footer: Date & Actions */}
              <div className="flex justify-between items-end mt-auto pt-4 border-t border-[var(--border-primary)]">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">Applied On</p>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{formatDate(job.applicationDate).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteJob(job); }}
                    className="text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                    title="Delete Application"
                  >
                    <FaTrashAlt />
                  </button>
                  {job.status?.toLowerCase() === 'offered' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); openOfferModal(job, e); }}
                      className="text-sm font-bold text-[#188155] dark:text-emerald-400 hover:underline"
                    >
                      {t("candidate.viewOffer", "View Offer")}
                    </button>
                  ) : (
                    <span className="text-sm font-bold text-[#188155] dark:text-emerald-400 hover:underline">
                      View Details
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Special Card: Find More Jobs */}
          <Link
            to="/candidate/job"
            className="bg-[var(--bg-elevated)] rounded-2xl p-6 border-2 border-dashed border-[var(--border-primary)] flex flex-col items-center justify-center h-[240px] cursor-pointer hover:border-[#188155] transition-all group"
          >
            <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center text-[var(--text-secondary)] group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/50 group-hover:text-[#188155] dark:group-hover:text-emerald-400 mb-4 transition-colors">
              <FaPlus size={20} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[#188155] dark:group-hover:text-emerald-400">Find more jobs</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Apply more</p>
          </Link>

          </div>
        ) : null}

        {/* ================== LIST VIEW (TABLE) ================== */}
        {!isLoading && !savedJobsLoading && !isCardView ? (
          <div className="bg-[var(--bg-elevated)] rounded-2xl shadow-sm border border-[var(--border-primary)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4"></th>
                    <th className="px-6 py-4 font-bold">Title</th>
                    <th className="px-6 py-4 font-bold">Company</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {visibleJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <td className="px-6 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-[#188155] border-[var(--border-primary)] rounded focus:ring-[#188155]"
                          checked={checkedJobIds.includes(job.id)}
                          onChange={() => handleCheckJob(job.id)}
                        />
                      </td>
                      <td className="px-6 py-4 cursor-pointer font-bold text-[var(--text-primary)]" onClick={() => openJobDetail(job)}>
                        {job.jobTitle}
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{job.companyName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${getBadgeStyle(job.status)}`}>
                          {getApplicationStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)] font-medium">{formatDate(job.applicationDate).toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checkedJobIds.length > 0 && (
              <div className="bg-[var(--bg-secondary)] px-6 py-4 border-t border-[var(--border-primary)] flex justify-end">
                <button
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
                  onClick={handleBulkDelete}
                >
                  Delete Selected ({checkedJobIds.length})
                </button>
              </div>
            )}
          </div>
        ) : null}

      </div>

      {/* ================== OFFER MODAL ================== */}
      {showOfferModal && selectedOfferJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[var(--border-primary)]">
            {/* Modal Header */}
            <div className="bg-emerald-600 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-0.5">{t("candidate.offerReceived", "You have received an offer!")}</p>
                <h2 className="text-xl font-bold text-white">{selectedOfferJob.jobTitle}</h2>
                <p className="text-emerald-100 text-sm mt-0.5">{selectedOfferJob.companyName}</p>
              </div>
              <button
                onClick={() => { setShowOfferModal(false); setSelectedOfferJob(null); }}
                className="text-emerald-200 hover:text-white transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Job Info */}
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {selectedOfferJob.companyName?.charAt(0) || "C"}
                </div>
                <div>
                  <p className="font-bold text-[var(--text-primary)]">{selectedOfferJob.jobTitle}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{selectedOfferJob.companyName} &middot; {selectedOfferJob.location || "Remote"}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {t("Applied On", "Applied On")}: {formatDate(selectedOfferJob.applicationDate).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Congratulations Message */}
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaCheck className="text-emerald-600 dark:text-emerald-400 text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{t("candidate.offerReceived", "You have received an offer!")}</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Please review the offer details from the recruiter. You can accept or decline this offer.
                </p>
              </div>

              {/* Decline Reason */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                  {t("candidate.declineOffer", "Decline Offer")} &mdash; {t("candidate.declineReasonPlaceholder", "Reason for declining (optional)")}
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder={t("candidate.declineReasonPlaceholder", "Reason for declining (optional)")}
                  rows={3}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDeclineOffer}
                  disabled={isResponding}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--border-primary)]"
                >
                  <FaTimes />
                  {t("candidate.declineOffer", "Decline Offer")}
                </button>
                <button
                  onClick={handleAcceptOffer}
                  disabled={isResponding}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <FaCheck />
                  {isResponding ? "..." : t("candidate.acceptOffer", "Accept Offer")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Applications;

Applications.propTypes = {
  initialTab: PropTypes.string,
};
