import { useEffect, useMemo, useState } from 'react';
import ApplicationDetail from './ApplicationDetail';
import { applicationsApi, jobPostsApi } from '../../lib/api/index';
import { SkeletonRow } from "../../Components/Skeleton";
import EmptyState from "../../Components/EmptyState";
import Pagination from "../../Components/Pagination";
import { showError, showSuccess } from '../../utils/toast';
import { FaUsers } from "react-icons/fa";

const PIPELINE_STAGES = [
  { id: "applied", label: "Applied", stage: "CV SCREENING", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  { id: "reviewed", label: "Reviewed", stage: "UNDER REVIEW", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { id: "scheduled_interview", label: "Interview", stage: "INTERVIEW", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { id: "accepted", label: "Offer", stage: "OFFER", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { id: "rejected", label: "Rejected", stage: "REJECTED", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
];

const stageMetaByStatus = PIPELINE_STAGES.reduce((acc, stage) => {
  acc[stage.id] = stage;
  return acc;
}, {});

const PAGE_SIZE = 10;

const toTitleCase = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const formatAppliedDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return `Applied on ${date.toLocaleDateString('en-US')}`;
};

const toDisplayRow = (row) => {
  const normalizedStatus = (row.status || '').toLowerCase();
  const stageMeta = stageMetaByStatus[normalizedStatus] || {
    stage: toTitleCase(normalizedStatus || 'applied'),
    badge: 'text-gray-700 bg-gray-100',
    dot: 'bg-gray-500',
  };

  return {
    id: row.id,
    jobPostId: row.jobPostId,
    applicationDate: row.applicationDate,
    status: normalizedStatus || 'applied',
    name: row.candidateName || 'Unknown Candidate',
    email: row.candidateEmail || '',
    phone: row.candidatePhone || '',
    rating: row.rating,
    coverLetter: row.coverLetter || '',
    noteCount: row.noteCount || 0,
    aiScore: row.aiScore ?? null,
    aiRecommendation: row.aiRecommendation || '',
    aiSummary: row.aiSummary || '',
    aiStrengths: Array.isArray(row.aiStrengths) ? row.aiStrengths : [],
    aiWeaknesses: Array.isArray(row.aiWeaknesses) ? row.aiWeaknesses : [],
    aiScreenedAt: row.aiScreenedAt || null,
    ref: `APP-${String(row.id).padStart(5, '0')}`,
    jobTitle: row.jobTitle || 'Unknown Position',
    department: row.companyName || 'Unknown Company',
    stage: stageMeta.stage,
    stageLabel: stageMeta.label || stageMeta.stage,
    stageColor: stageMeta.badge,
    stageDot: stageMeta.dot,
    subtext: formatAppliedDate(row.applicationDate),
    matchScore: row.aiScore ?? (row.rating ? row.rating * 20 : 70),
    avatar: `https://api.dicebear.com/8.x/notionists/svg?seed=${encodeURIComponent(row.candidateName || row.id)}`,
  };
};

const Application = () => {
  // State quản lý việc chuyển đổi giữa màn hình Danh sách và màn hình Chi tiết
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applications, setApplications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [jobOptions, setJobOptions] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('all');
  const [sortBy, setSortBy] = useState('applied_at');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState("list");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const [applicationsResult, jobsResult] = await Promise.all([
          applicationsApi.listForRecruiterPaginated({
            page: currentPage,
            limit: PAGE_SIZE,
            jobPostId: selectedJobId,
            sortBy: sortBy,
            sortOrder: 'desc',
          }),
          jobPostsApi.listMine(),
        ]);



        if (isMounted) {
          const applicationItems = Array.isArray(applicationsResult)
            ? applicationsResult
            : applicationsResult.data || [];
          setApplications(applicationItems);
          setTotalApplications(
            Array.isArray(applicationsResult)
              ? applicationItems.length
              : Number(applicationsResult.total || 0)
          );
          setTotalPages(
            Array.isArray(applicationsResult)
              ? 1
              : Math.max(Number(applicationsResult.totalPages || 1), 1)
          );
          setJobOptions(Array.isArray(jobsResult) ? jobsResult : []);
        }

      } catch (loadError) {
        if (isMounted) {
          setApplications([]);
          setJobOptions([]);
          setError(loadError.message || 'Failed to load applications');
          showError(loadError.message || 'Failed to load applications');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentPage, selectedJobId, sortBy]);

  const filteredApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      if (sortBy === 'ai_score') {
        const scoreA = a.aiScore ?? -1;
        const scoreB = b.aiScore ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (selectedJobId === 'all') {
        const titleCompare = (a.jobTitle || '').localeCompare(b.jobTitle || '');
        if (titleCompare !== 0) return titleCompare;
      }

      return new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime();
    });
  }, [applications, selectedJobId, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedJobId, sortBy]);

  const displayApplications = useMemo(
    () => filteredApplications.map(toDisplayRow),
    [filteredApplications]
  );

  const applicationsByStage = useMemo(() => {
    const grouped = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, []]));
    displayApplications.forEach((app) => {
      const key = grouped[app.status] ? app.status : "applied";
      grouped[key].push(app);
    });
    return grouped;
  }, [displayApplications]);

  const updateApplicationStatus = async (applicationId, status) => {
    if (status === "scheduled_interview" || status === "accepted" || status === "rejected") {
      const app = displayApplications.find((item) => item.id === applicationId);
      if (app) {
        setSelectedApplication(app);
      }
      return;
    }

    try {
      setUpdatingApplicationId(applicationId);
      const updated = await applicationsApi.updateStatus(applicationId, status);
      setApplications((current) =>
        current.map((item) =>
          item.id === applicationId ? { ...item, status: updated.status || status } : item
        )
      );
      setError("");
      showSuccess("Application status updated");
    } catch (error) {
      const message = error.message || "Failed to update application status";
      setError(message);
      showError(message);
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const metrics = useMemo(() => {
    const pendingReview = filteredApplications.filter((item) => item.status === 'applied').length;
    const initialScreening = pendingReview;
    const interviewStage = filteredApplications.filter((item) => item.status === 'reviewed' || item.status === 'scheduled_interview').length;
    const offersOut = filteredApplications.filter((item) => item.status === 'accepted').length;

    return {
      pendingReview,
      initialScreening,
      interviewStage,
      offersOut,
    };
  }, [filteredApplications]);

  // Nếu có ứng viên được chọn, render trang Chi tiết (ApplicationDetail)
  if (selectedApplication) {
    return (
      <div className="flex-1">
        <ApplicationDetail candidate={selectedApplication} onBack={() => setSelectedApplication(null)} />
      </div>
    );
  }

  // --- Render Màn hình Danh sách ---
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-6 pb-12">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Applications</h1>
            <p className="text-gray-500 mt-1">Streamlining the journey from application to hire.</p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pending Review</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-gray-900">{metrics.pendingReview}</span>
              <span className="text-sm font-semibold text-orange-500">{metrics.pendingReview > 0 ? 'Action Required' : 'Up to date'}</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Initial Screening</p>
            <span className="text-4xl font-extrabold text-gray-900">{metrics.initialScreening}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Interview Stage</p>
            <span className="text-4xl font-extrabold text-gray-900">{metrics.interviewStage}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Offers Out</p>
            <span className="text-4xl font-extrabold text-gray-900">{metrics.offersOut}</span>
          </div>
        </div>

        {/* Toolbar (Filters & View Toggle) */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
              <span>Active Job:</span>
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="cursor-pointer bg-transparent font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="all">All Jobs</option>
                {jobOptions.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
              <span>Sort By:</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="cursor-pointer bg-transparent font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="applied_at">Newest First</option>
                <option value="ai_score">AI Match Score (High to Low)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-1 shadow-sm">
            {["list", "pipeline"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-semibold capitalize transition-colors ${
                  viewMode === mode
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {mode === "list" ? "List" : "Pipeline"}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "pipeline" && !loading && !error ? (
          displayApplications.length === 0 ? (
            <div className="blueprint-card p-0">
              <EmptyState
                icon={FaUsers}
                title="No applications found"
                description="Applications will appear here once candidates apply to your job posts."
                actionLabel="Manage Jobs"
                onAction={() => setSelectedJobId("all")}
              />
            </div>
          ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[360px]">
                <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <h2 className="font-bold text-gray-900">{stage.label}</h2>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{applicationsByStage[stage.id].length}</span>
                </div>
                <div className="p-3 space-y-3">
                  {applicationsByStage[stage.id].map((app) => (
                    <div key={app.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 hover:bg-white hover:shadow-sm transition">
                      <button type="button" onClick={() => setSelectedApplication(app)} className="text-left w-full">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-gray-900">{app.name}</p>
                            <p className="text-sm text-gray-500 mt-1">{app.jobTitle}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {app.noteCount > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                                {app.noteCount} notes
                              </span>
                            )}
                            {app.aiScore !== null && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                                AI {app.aiScore}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{app.subtext}</p>
                      </button>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-600">
                          {app.rating ? `${app.rating}/5` : "No rating"}
                        </span>
                        <select
                          value={app.status}
                          disabled={updatingApplicationId === app.id}
                          onChange={(event) => updateApplicationStatus(app.id, event.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700"
                        >
                          {PIPELINE_STAGES.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {applicationsByStage[stage.id].length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                      No candidates
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div>
              {Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-center text-red-500">{error}</div>
          ) : (
          <table className="w-full text-left">
            <thead className="bg-white border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-5">Candidate & Application</th>
                <th className="px-6 py-5">Applied Job</th>
                <th className="px-6 py-5">Recruitment Funnel Stage</th>
                <th className="px-6 py-5">Match Score</th>
                <th className="px-6 py-5 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayApplications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                  
                  {/* Cột 1: Thông tin ứng viên */}
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <img src={app.avatar} alt="avatar" className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200" />
                      <div>
                        <p className="font-bold text-gray-900">{app.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <p className="text-xs font-medium text-gray-400">REF: {app.ref}</p>
                          {app.aiScore !== null && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                              AI {app.aiScore}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Cột 2: Vị trí ứng tuyển */}
                  <td className="px-6 py-5">
                    <p className="font-bold text-gray-900">{app.jobTitle}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{app.department}</p>
                  </td>

                  {/* Cột 3: Trạng thái (Stage) */}
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${app.stageColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${app.stageDot}`}></span>
                      {app.stage}
                    </span>
                    <p className={`text-xs mt-2 font-medium ${app.subtextColor || 'text-gray-500'}`}>{app.subtext}</p>
                  </td>

                  {/* Cột 4: Mức độ phù hợp (Match Score) */}
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${app.matchScore >= 80 ? 'bg-emerald-600' : app.matchScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                          style={{ width: `${app.matchScore}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${app.matchScore >= 80 ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {app.matchScore}%
                      </span>
                    </div>

                    {/* Điểm mạnh & Điểm yếu tóm tắt từ AI */}
                    {(app.aiStrengths?.length > 0 || app.aiWeaknesses?.length > 0) && (
                      <div className="mt-2 text-xs space-y-1 max-w-xs">
                        {app.aiStrengths?.length > 0 && (
                          <div className="flex items-start gap-1 text-emerald-700">
                            <span className="font-bold shrink-0">✓</span>
                            <span className="line-clamp-1 truncate" title={app.aiStrengths[0]}>
                              {app.aiStrengths[0]}
                            </span>
                          </div>
                        )}
                        {app.aiWeaknesses?.length > 0 && (
                          <div className="flex items-start gap-1 text-amber-700">
                            <span className="font-bold shrink-0">!</span>
                            <span className="line-clamp-1 truncate" title={app.aiWeaknesses[0]}>
                              {app.aiWeaknesses[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Cột 5: Hành động */}
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedApplication(app)} // Kích hoạt sự kiện mở chi tiết
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <select
                        value={app.status}
                        disabled={updatingApplicationId === app.id}
                        onChange={(event) => updateApplicationStatus(app.id, event.target.value)}
                        className="px-3 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors outline-none disabled:bg-gray-300"
                      >
                        {PIPELINE_STAGES.map((option) => (
                          <option key={option.id} value={option.id} className="text-gray-800 bg-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}

              {displayApplications.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={FaUsers}
                      title="No applications found"
                      description="Applications will appear here once candidates apply to your job posts."
                      actionLabel={selectedJobId !== "all" ? "Show All Jobs" : undefined}
                      onAction={selectedJobId !== "all" ? () => setSelectedJobId("all") : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}

          {/* Footer / Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {displayApplications.length} of {totalApplications} applications
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Application;
