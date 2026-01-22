"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import ComposeModal from "../components/ComposeModal";
import {
  Search,
  Clock,
  Send,
  ChevronLeft,
  Archive,
  Trash2,
  MoreHorizontal,
  Star,
} from "lucide-react";

type EmailRow = {
  id: string;
  toEmail: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  emailJob: {
    subject: string;
    body: string;
    fromEmail: string;
  };
};

export default function Dashboard() {
  const { user, logout, token, ready } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<EmailRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null);
  const [viewingEmail, setViewingEmail] = useState<EmailRow | null>(null);

  

useEffect(() => {
  if (!ready) return;       // ✅ wait until localStorage loaded
  if (!user) router.push("/");
}, [ready, user, router]);


  async function fetchAllData() {
    if (!token || !user?.email) return;

    setLoading(true);
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        api.get("/emails/scheduled", { params: { userEmail: user.email } }),
        api.get("/emails/sent", { params: { userEmail: user.email } }),
      ]);

      const allEmails = [
        ...(scheduledRes.data.data || []),
        ...(sentRes.data.data || []),
      ];

      setAllData(allEmails);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const scheduledData = useMemo(
    () => allData.filter((e) => ["scheduled", "processing"].includes(e.status)),
    [allData]
  );

  const sentData = useMemo(
    () => allData.filter((e) => ["sent", "failed"].includes(e.status)),
    [allData]
  );

  const currentData = tab === "scheduled" ? scheduledData : sentData;

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return currentData;

    return currentData.filter((email) => {
      return (
        email.toEmail.toLowerCase().includes(q) ||
        email.emailJob.subject.toLowerCase().includes(q)
      );
    });
  }, [currentData, searchQuery]);

  if (!user) return null;

  return (
    <div className="h-screen w-screen bg-white overflow-hidden">
      <div className="h-full grid grid-cols-[260px_1fr]">
        {/* ===================== SIDEBAR ===================== */}
        <aside className="border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">ONB</h1>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-medium shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name?.[0]?.toUpperCase() ||
                  user.email?.[0]?.toUpperCase() ||
                  "U"
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>

              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                title="Logout"
              >
                ×
              </button>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Compose
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <p className="text-xs font-medium text-gray-400 mb-3">MAIL</p>

            <div className="space-y-1">
              <button
                onClick={() => {
                  setTab("scheduled");
                  setViewingEmail(null);
                  setSelectedEmail(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  tab === "scheduled"
                    ? "bg-green-50 text-green-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Clock size={18} />
                <span className="flex-1 text-left">Scheduled</span>
                <span className="text-xs">{scheduledData.length}</span>
              </button>

              <button
                onClick={() => {
                  setTab("sent");
                  setViewingEmail(null);
                  setSelectedEmail(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  tab === "sent"
                    ? "bg-green-50 text-green-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Send size={18} />
                <span className="flex-1 text-left">Sent</span>
                <span className="text-xs">{sentData.length}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ===================== RIGHT AREA ===================== */}
        <section className="h-full">
          <div
            className={`h-full grid ${
              viewingEmail ? "grid-cols-[1fr_500px]" : "grid-cols-1"
            }`}
          >
            {/* ===================== LIST AREA ===================== */}
            <div className="flex flex-col min-w-0 bg-white">
              {/* Search */}
              <div className="h-16 border-b border-gray-200 flex items-center px-6 bg-white shrink-0">
                <div className="relative w-full max-w-xl">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email List */}
              <div className="flex-1 overflow-y-auto bg-white">
                {loading && allData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Loading...
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No emails found.
                  </div>
                ) : (
                  <div className="w-full">
                    {filteredData.map((email) => {
                      const isActive = selectedEmail?.id === email.id;

                      const isScheduledTab = tab === "scheduled";

                      const previewText = email.emailJob.body
                        .replace(/<[^>]*>/g, "")
                        .replace(/\s+/g, " ")
                        .trim();

                      const timeText = isScheduledTab
                        ? new Date(email.scheduledAt).toLocaleString("en-US", {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : email.sentAt
                        ? new Date(email.sentAt).toLocaleString("en-US", {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "N/A";

                      const badgeText = isScheduledTab
                        ? `⏰ ${timeText}`
                        : email.status === "sent"
                        ? `✓ ${timeText}`
                        : "✗ Failed";

                      const badgeClass = isScheduledTab
                        ? "bg-orange-100 text-orange-700"
                        : email.status === "sent"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700";

                      return (
                        <button
                          key={email.id}
                          onClick={() => {
                            setSelectedEmail(email);
                            setViewingEmail(email);
                          }}
                          className={`w-full text-left px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            isActive ? "bg-green-50" : ""
                          }`}
                        >
                          {/* SINGLE ROW LIKE FIGMA */}
                          <div className="flex items-center gap-4 min-w-0">
                            {/* To */}
                            <div className="w-[240px] min-w-[240px] truncate text-sm text-gray-900">
                              <span className="text-gray-500">To:</span>{" "}
                              <span className="font-medium">{email.toEmail}</span>
                            </div>

                            {/* Badge */}
                            <span
                              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0 ${badgeClass}`}
                            >
                              {badgeText}
                            </span>

                            {/* Subject + Preview */}
                            <div className="flex-1 min-w-0 truncate text-sm text-gray-900">
                              <span className="font-medium">
                                {email.emailJob.subject}
                              </span>
                              <span className="text-gray-400"> — </span>
                              <span className="text-gray-500">
                                {previewText || "—"}
                              </span>
                            </div>

                            {/* Star icon right */}
                            <div className="shrink-0 pl-2">
                              <Star
                                size={18}
                                className="text-gray-300 hover:text-gray-500"
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ===================== PREVIEW PANEL ===================== */}
            {viewingEmail && (
              <div className="border-l border-gray-200 bg-white flex flex-col min-w-0">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => setViewingEmail(null)}
                    className="text-gray-600 hover:text-gray-900"
                    title="Back"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div className="flex items-center gap-1">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Archive size={18} className="text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <Trash2 size={18} className="text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <MoreHorizontal size={18} className="text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <h2 className="text-xl font-medium text-gray-900 mb-3">
                    {viewingEmail.emailJob.subject}
                  </h2>

                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs shrink-0">
                        {viewingEmail.emailJob.fromEmail[0].toUpperCase()}
                      </div>
                      <span className="truncate">
                        {viewingEmail.emailJob.fromEmail}
                      </span>
                    </div>

                    <span className="shrink-0">→</span>

                    <span className="truncate">{viewingEmail.toEmail}</span>
                  </div>

                  <div className="text-xs text-gray-500 mb-5">
                    {tab === "scheduled" ? (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                        Scheduled:{" "}
                        {new Date(viewingEmail.scheduledAt).toLocaleString()}
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded ${
                          viewingEmail.status === "sent"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {viewingEmail.status === "sent" ? "Sent" : "Failed"}:{" "}
                        {viewingEmail.sentAt
                          ? new Date(viewingEmail.sentAt).toLocaleString()
                          : "N/A"}
                      </span>
                    )}
                  </div>

                  <div
                    className="prose prose-sm max-w-none text-gray-900"
                    dangerouslySetInnerHTML={{
                      __html: viewingEmail.emailJob.body,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Compose Modal */}
      {open && (
        <ComposeModal
          open={open}
          onClose={() => setOpen(false)}
          onScheduled={() => fetchAllData()}
          userEmail={user.email}
        />
      )}
    </div>
  );
}
