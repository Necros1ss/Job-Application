import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaBriefcase,
  FaChevronLeft,
  FaChevronRight,
  FaEnvelope,
  FaEnvelopeOpen,
  FaInbox,
  FaPaperPlane,
} from "react-icons/fa";
import { SkeletonCard } from "../../Components/Skeleton";
import { messagesApi } from "../../lib/api/index";
import { formatMessageTime } from "../../utils/format";
import { useI18n } from "../../lib/i18n";
import { showError } from "../../utils/toast";

const PAGE_SIZE = 15;

const formatFullDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AVATAR_PALETTE = [
  ["bg-[#0a0a0a]", "text-white"],
  ["bg-[#2563eb]", "text-white"],
  ["bg-[#7c3aed]", "text-white"],
  ["bg-[#059669]", "text-white"],
  ["bg-[#dc2626]", "text-white"],
  ["bg-[#d97706]", "text-white"],
];

const getAvatarColors = (name = "") => {
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

const EmptyInbox = ({ tab }) => {
  const { t } = useI18n();
  if (tab === "unread") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-secondary)]">
          <FaEnvelopeOpen size={24} className="text-[var(--text-secondary)]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("messages.noUnreadTitle")}</h3>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">You&apos;re all caught up.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-secondary)]">
        <FaInbox size={24} className="text-[var(--text-secondary)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("messages.emptyTitle")}</h3>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{t("messages.emptyDescription")}</p>
    </div>
  );
};

EmptyInbox.propTypes = {
  tab: PropTypes.string,
};

const EmptyDetail = () => {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-[var(--bg-secondary)] blur-xl opacity-50" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-secondary)]">
          <FaPaperPlane size={20} className="text-[var(--text-secondary)]" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("messages.selectTitle")}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--text-secondary)]">{t("messages.selectDescription")}</p>
    </div>
  );
};

const MessageListItem = ({ message, isSelected, onClick }) => {
  const [bgClass, textClass] = getAvatarColors(message.senderName || "");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full px-4 py-3.5 text-left transition-all duration-150 border-b border-[var(--border-primary)] ${
        isSelected
          ? "bg-[var(--bg-secondary)]"
          : "hover:bg-[var(--bg-secondary)]/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold ${bgClass} ${textClass}`}
        >
          {getInitials(message.senderName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`truncate text-[13px] ${
                message.isRead ? "font-medium text-[var(--text-secondary)]" : "font-semibold text-[var(--text-primary)]"
              }`}
            >
              {message.senderName || "Unknown recruiter"}
            </p>
            <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>

          <p
            className={`mt-0.5 truncate text-[13px] ${
              message.isRead ? "text-[var(--text-secondary)]" : "font-medium text-[var(--text-primary)]"
            }`}
          >
            {message.subject}
          </p>

          <p className="mt-0.5 truncate text-[12px] leading-snug text-[var(--text-secondary)]">
            {message.content}
          </p>
        </div>

        {!message.isRead && (
          <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--text-primary)]" />
        )}
      </div>
    </button>
  );
};

MessageListItem.propTypes = {
  message: PropTypes.object.isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func,
};

const MessageDetail = ({ message, onBack, onViewJob, t }) => {
  const [bgClass, textClass] = getAvatarColors(message.senderName || "");
  const contentRef = useRef(null);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-primary)] px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:hidden"
        >
          <FaArrowLeft size={12} />
          {t("common.back")}
        </button>

        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold ${bgClass} ${textClass}`}
          >
            {getInitials(message.senderName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  {t("messages.from")}
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-[var(--text-primary)]">
                  {message.senderName || "Unknown recruiter"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {formatFullDateTime(message.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <h1 className="mt-4 text-[18px] font-semibold leading-snug text-[var(--text-primary)]">
          {message.subject}
        </h1>

        {(message.jobTitle || message.jobPostId) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {message.jobTitle && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <FaBriefcase size={10} />
                {message.jobTitle}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5" ref={contentRef}>
        <div className="text-[14px] leading-7 text-[var(--text-primary)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>

      {message.jobPostId && (
        <div className="border-t border-[var(--border-primary)] px-6 py-4">
          <button
            type="button"
            onClick={onViewJob}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-rich-black)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-canvas-white)] hover:opacity-90 transition-opacity"
          >
            {t("messages.viewJob")}
          </button>
        </div>
      )}
    </div>
  );
};

MessageDetail.propTypes = {
  message: PropTypes.object.isRequired,
  onBack: PropTypes.func,
  onViewJob: PropTypes.func,
  t: PropTypes.func.isRequired,
};

const Messages = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const listRef = useRef(null);

  const loadMessages = async (pageOffset = 0) => {
    try {
      setIsLoading(true);
      const [inbox, unread] = await Promise.all([
        messagesApi.inbox({ limit: PAGE_SIZE, offset: pageOffset }),
        messagesApi.unreadCount(),
      ]);

      const normalizedMessages = Array.isArray(inbox) ? inbox : [];
      setMessages(normalizedMessages);
      setUnreadCount(Number(unread?.count ?? unread?.unreadCount ?? 0));

      if (normalizedMessages.length > 0) {
        setSelectedMessage((current) => {
          if (current) {
            return normalizedMessages.find((item) => item.id === current.id) || normalizedMessages[0] || null;
          }
          return normalizedMessages[0] || null;
        });
      }
      setErrorMessage("");
    } catch (error) {
      const message = error.message || "Failed to load messages";
      setErrorMessage(message);
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages(offset);
  }, [offset]);

  const visibleMessages = useMemo(() => {
    if (activeTab === "unread") {
      return messages.filter((m) => !m.isRead);
    }
    return messages;
  }, [activeTab, messages]);

  const openMessage = async (message) => {
    setSelectedMessage(message);
    setShowDetailOnMobile(true);

    if (message.isRead) return;

    try {
      const updated = await messagesApi.markRead(message.id);
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, isRead: updated.isRead, readAt: updated.readAt }
            : item
        )
      );
      setSelectedMessage((current) =>
        current?.id === message.id
          ? { ...current, isRead: updated.isRead, readAt: updated.readAt }
          : current
      );
      setUnreadCount((current) => Math.max(current - 1, 0));
    } catch (error) {
      showError(error.message || "Failed to mark message as read");
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setOffset(0);
    loadMessages(0);
  };

  const handleNextPage = () => {
    if (messages.length === PAGE_SIZE) {
      setOffset((current) => current + PAGE_SIZE);
    }
  };

  const handlePrevPage = () => {
    setOffset((current) => Math.max(current - PAGE_SIZE, 0));
  };

  const hasPrevPage = offset > 0;
  const hasNextPage = messages.length === PAGE_SIZE;
  const totalShown = offset + messages.length;
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-12 pt-6 lg:px-10">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("messages.kicker")}
            </p>
            <h1 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
              {t("messages.title")}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{t("messages.subtitle")}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-2.5 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {t("messages.unread")}
              </p>
              <p className="mt-0.5 text-xl font-bold text-[var(--text-primary)]">{unreadCount}</p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-[680px] overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] shadow-sm">
            <div className="w-full sm:w-80 border-r border-[var(--border-primary)] p-4 space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="hidden flex-1 sm:block p-6">
              <SkeletonCard />
            </div>
          </div>
        ) : messages.length > 0 ? (
          <div className="flex h-[680px] overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] shadow-sm">
            <aside
              className={`w-full sm:w-80 shrink-0 flex flex-col border-r border-[var(--border-primary)] bg-[var(--bg-elevated)] ${
                showDetailOnMobile ? "hidden sm:flex" : "flex"
              }`}
            >
              <div className="border-b border-[var(--border-primary)] px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("messages.inbox")}</h2>
                  <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {totalShown}
                  </span>
                </div>

                <div className="inline-flex rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
                  <button
                    type="button"
                    onClick={() => handleTabChange("all")}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${
                      activeTab === "all"
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t("messages.all")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("unread")}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "unread"
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t("messages.unread")}
                    {unreadCount > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-rich-black)] px-1 text-[10px] font-bold text-[var(--color-canvas-white)]">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto" ref={listRef}>
                {visibleMessages.length > 0 ? (
                  visibleMessages.map((message) => (
                    <MessageListItem
                      key={message.id}
                      message={message}
                      isSelected={selectedMessage?.id === message.id}
                      onClick={() => openMessage(message)}
                    />
                  ))
                ) : (
                  <EmptyInbox tab={activeTab} />
                )}
              </div>

              <div className="border-t border-[var(--border-primary)] px-4 py-2.5 flex items-center justify-between">
                <button
                  type="button"
                  disabled={!hasPrevPage}
                  onClick={handlePrevPage}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <FaChevronLeft size={11} />
                  Prev
                </button>
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {pageNumber}
                </span>
                <button
                  type="button"
                  disabled={!hasNextPage}
                  onClick={handleNextPage}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <FaChevronRight size={11} />
                </button>
              </div>
            </aside>

            <section
              className={`flex-1 flex flex-col ${
                showDetailOnMobile ? "flex" : "hidden sm:flex"
              }`}
            >
              {selectedMessage ? (
                <MessageDetail
                  message={selectedMessage}
                  onBack={() => setShowDetailOnMobile(false)}
                  onViewJob={() => navigate(`/jobs/${selectedMessage.jobPostId}`)}
                  t={t}
                />
              ) : (
                <EmptyDetail />
              )}
            </section>
          </div>
        ) : (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-elevated)]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-secondary)]">
              <FaEnvelope size={20} className="text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("messages.emptyTitle")}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("messages.emptyDescription")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
