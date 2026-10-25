import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import {
  BOOKING_TIME_SLOTS,
  CALENDAR_WEEK_DATES,
  formatTime12h,
  getStylistsForSalon,
} from "../../services/cockpitService";
import { PERSONAS, SALONS } from "../../services/syntheticDataService";
import {
  AIAssistSuggestion,
  AppointmentStatus,
  CustomerInteraction,
  GuestAppointment,
  InteractionChannel,
  InteractionLifecycle,
} from "../../types/domain";

interface CockpitCalendarConsoleViewProps {
  defaultFocus?: "split" | "console-full";
}

export const CockpitCalendarConsoleView: React.FC<
  CockpitCalendarConsoleViewProps
> = ({ defaultFocus = "split" }) => {
  const {
    activePersona,
    authSession,
    appointments,
    interactions,
    aiAssistLoading,
    rescheduleAppointment,
    cancelAppointment,
    sendConsoleManagerReply,
    simulateIncomingCustomerTurn,
    askCockpitAiAssist,
    policy,
  } = useAppState();

  const persona = PERSONAS[activePersona];

  // Workspace layout mode: side-by-side Calendar + Console, Calendar full width, or Console full width
  const [workspaceLayout, setWorkspaceLayout] = useState<
    "split" | "calendar-full" | "console-full"
  >(defaultFocus === "console-full" ? "console-full" : "split");

  useEffect(() => {
    setWorkspaceLayout(
      defaultFocus === "console-full" ? "console-full" : "split"
    );
  }, [defaultFocus]);

  // Calendar state
  const [calendarMode, setCalendarMode] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState<string>("2026-10-25");
  const [salonFilter, setSalonFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">(
    "ALL"
  );
  const [onlyWithInteractions, setOnlyWithInteractions] =
    useState<boolean>(false);
  const [calendarSearch, setCalendarSearch] = useState<string>("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >("APT-401");

  // Console state
  const [lifecycleFilter, setLifecycleFilter] = useState<
    InteractionLifecycle | "ALL"
  >("Live");
  const [channelFilter, setChannelFilter] = useState<
    InteractionChannel | "ALL"
  >("ALL");
  const [consoleSearch, setConsoleSearch] = useState<string>("");
  const [selectedInteractionId, setSelectedInteractionId] = useState<string>(
    "INT-901"
  );
  const [replyDraft, setReplyDraft] = useState<string>("");
  const [customToughQuestion, setCustomToughQuestion] = useState<string>("");
  const [adHocAssistResult, setAdHocAssistResult] =
    useState<AIAssistSuggestion | null>(null);

  // Reschedule Modal state
  const [rescheduleTarget, setRescheduleTarget] =
    useState<GuestAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("2026-10-26");
  const [rescheduleTime, setRescheduleTime] = useState<string>("11:00");
  const [rescheduleStylist, setRescheduleStylist] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [rescheduleWaiveFee, setRescheduleWaiveFee] = useState<boolean>(true);

  // Cancel Modal state
  const [cancelTarget, setCancelTarget] = useState<GuestAppointment | null>(
    null
  );
  const [cancelReason, setCancelReason] = useState<string>(
    "Customer requested via Live Chat / Voice interaction"
  );
  const [cancelWaiveFee, setCancelWaiveFee] = useState<boolean>(true);

  const authorizedSalons = useMemo(() => {
    if (authSession.roleKey === "front_desk_staff") {
      return SALONS.filter((s) => s.id === "SLN-PNW-01");
    }
    if (persona.canViewAllRegions) return SALONS;
    const allowed = new Set(persona.allowedSalonIds);
    return SALONS.filter((s) => allowed.has(s.id));
  }, [persona, authSession.roleKey]);

  // Reset salonFilter if persona changes and selected salon is out of scope
  useEffect(() => {
    if (
      salonFilter !== "ALL" &&
      !authorizedSalons.some((s) => s.id === salonFilter)
    ) {
      setSalonFilter("ALL");
    }
  }, [authorizedSalons, salonFilter]);

  // Filtered appointments (excluding date so Week View can render all 7 days)
  const baseFilteredAppointments = useMemo(() => {
    const q = calendarSearch.trim().toLowerCase();
    return appointments
      .filter((apt) => {
        if (salonFilter !== "ALL" && apt.salonId !== salonFilter) return false;
        if (statusFilter !== "ALL" && apt.status !== statusFilter) return false;
        if (onlyWithInteractions && !apt.linkedInteractionId) return false;
        if (q) {
          const hay =
            `${apt.id} ${apt.guestName} ${apt.serviceName} ${apt.stylistName} ${apt.salonName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [
    appointments,
    salonFilter,
    statusFilter,
    onlyWithInteractions,
    calendarSearch,
  ]);

  const dayAppointments = useMemo(
    () => baseFilteredAppointments.filter((a) => a.date === selectedDate),
    [baseFilteredAppointments, selectedDate]
  );

  // Filtered console interactions
  const filteredInteractions = useMemo(() => {
    const q = consoleSearch.trim().toLowerCase();
    return interactions.filter((inter) => {
      if (salonFilter !== "ALL" && inter.salonId !== salonFilter) return false;
      if (lifecycleFilter !== "ALL" && inter.lifecycle !== lifecycleFilter)
        return false;
      if (channelFilter !== "ALL" && inter.channel !== channelFilter)
        return false;
      if (q) {
        const transcriptText = inter.turns.map((t) => t.text).join(" ");
        const hay =
          `${inter.guestName} ${inter.salonName} ${inter.topic} ${transcriptText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    interactions,
    salonFilter,
    lifecycleFilter,
    channelFilter,
    consoleSearch,
  ]);

  // Ensure selectedInteractionId stays valid when filters or roles change
  useEffect(() => {
    if (
      filteredInteractions.length > 0 &&
      !filteredInteractions.some((i) => i.id === selectedInteractionId)
    ) {
      setSelectedInteractionId(filteredInteractions[0].id);
    }
  }, [filteredInteractions, selectedInteractionId]);

  const activeInteraction: CustomerInteraction | undefined = useMemo(
    () =>
      interactions.find((i) => i.id === selectedInteractionId) ??
      filteredInteractions[0] ??
      interactions[0],
    [interactions, filteredInteractions, selectedInteractionId]
  );

  const linkedAppointmentForConsole: GuestAppointment | undefined = useMemo(
    () =>
      activeInteraction?.linkedAppointmentId
        ? appointments.find((a) => a.id === activeInteraction.linkedAppointmentId)
        : undefined,
    [appointments, activeInteraction]
  );

  // KPI summary metrics
  const kpiStats = useMemo(() => {
    const activeToday = appointments.filter(
      (a) => a.date === selectedDate && a.status !== "Cancelled"
    );
    const bookedRevenue = activeToday.reduce((s, a) => s + a.priceUsd, 0);
    const liveCount = interactions.filter((i) => i.lifecycle === "Live").length;
    const liveVoiceCount = interactions.filter(
      (i) => i.lifecycle === "Live" && i.channel === "Voice"
    ).length;
    const liveChatCount = liveCount - liveVoiceCount;
    const rescheduledCount = appointments.filter(
      (a) => a.status === "Rescheduled"
    ).length;
    const cancelledCount = appointments.filter(
      (a) => a.status === "Cancelled"
    ).length;
    const toughCount = interactions.filter(
      (i) => i.lifecycle === "Live" && i.hasToughQuestion
    ).length;

    return {
      activeTodayCount: activeToday.length,
      bookedRevenue,
      liveCount,
      liveChatCount,
      liveVoiceCount,
      rescheduledCount,
      cancelledCount,
      toughCount,
    };
  }, [appointments, interactions, selectedDate]);

  // Open Reschedule Modal with optional AI-suggested defaults
  const openRescheduleModal = (
    apt: GuestAppointment,
    suggested?: {
      date?: string;
      time?: string;
      stylist?: string;
      reason?: string;
    }
  ) => {
    const linked = apt.linkedInteractionId
      ? interactions.find((i) => i.id === apt.linkedInteractionId)
      : undefined;
    const stylists = getStylistsForSalon(apt.salonId);
    setRescheduleTarget(apt);
    setRescheduleDate(
      suggested?.date ??
        linked?.aiAssist.recommendedDate ??
        (apt.date === "2026-10-25" ? "2026-10-26" : apt.date)
    );
    setRescheduleTime(
      suggested?.time ?? linked?.aiAssist.recommendedTime ?? apt.startTime
    );
    setRescheduleStylist(
      suggested?.stylist ??
        linked?.aiAssist.recommendedStylist ??
        (stylists.includes(apt.stylistName) ? apt.stylistName : stylists[0])
    );
    setRescheduleReason(
      suggested?.reason ??
        (linked
          ? `Per ${linked.channel} (${linked.id}): ${linked.topic}`
          : "Guest requested new appointment slot")
    );
    setRescheduleWaiveFee(true);
  };

  const openCancelModal = (apt: GuestAppointment) => {
    const linked = apt.linkedInteractionId
      ? interactions.find((i) => i.id === apt.linkedInteractionId)
      : undefined;
    setCancelTarget(apt);
    setCancelReason(
      linked
        ? `Per ${linked.channel} (${linked.id}): ${linked.topic}`
        : "Customer requested cancellation"
    );
    setCancelWaiveFee(true);
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    rescheduleAppointment({
      appointmentId: rescheduleTarget.id,
      newDate: rescheduleDate,
      newStartTime: rescheduleTime,
      newStylistName: rescheduleStylist,
      reason: rescheduleReason.trim() || "Customer interaction reschedule",
      waiveFee: rescheduleWaiveFee,
    });
    setSelectedDate(rescheduleDate);
    setSelectedAppointmentId(rescheduleTarget.id);
    setRescheduleTarget(null);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    cancelAppointment({
      appointmentId: cancelTarget.id,
      reason: cancelReason.trim() || "Customer requested cancellation",
      waiveCancellationFee: cancelWaiveFee,
    });
    setCancelTarget(null);
  };

  const handleSelectAppointmentCard = (apt: GuestAppointment) => {
    setSelectedAppointmentId(apt.id);
    if (apt.linkedInteractionId) {
      const targetInter = interactions.find(
        (i) => i.id === apt.linkedInteractionId
      );
      if (targetInter) {
        if (
          lifecycleFilter !== "ALL" &&
          targetInter.lifecycle !== lifecycleFilter
        ) {
          setLifecycleFilter("ALL");
        }
        if (channelFilter !== "ALL" && targetInter.channel !== channelFilter) {
          setChannelFilter("ALL");
        }
        setSelectedInteractionId(targetInter.id);
        setAdHocAssistResult(null);
      }
    }
  };

  const handleSelectInteractionRow = (inter: CustomerInteraction) => {
    setSelectedInteractionId(inter.id);
    setAdHocAssistResult(null);
    if (inter.linkedAppointmentId) {
      const apt = appointments.find((a) => a.id === inter.linkedAppointmentId);
      if (apt) {
        setSelectedAppointmentId(apt.id);
        setSelectedDate(apt.date);
      }
    }
  };

  const handleSendManagerReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInteraction || !replyDraft.trim()) return;
    sendConsoleManagerReply(activeInteraction.id, replyDraft);
    setReplyDraft("");
  };

  const handleAskCustomAiAssist = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = customToughQuestion.trim();
    if (!q) return;
    const suggestion = await askCockpitAiAssist({
      interactionId: activeInteraction?.id,
      customQuestion: q,
    });
    setAdHocAssistResult(suggestion);
    setCustomToughQuestion("");
  };

  const handleRefreshConversationAiAssist = async (questionText?: string) => {
    if (!activeInteraction) return;
    const targetQ =
      questionText ??
      activeInteraction.aiAssist.toughQuestion ??
      activeInteraction.turns[activeInteraction.turns.length - 1]?.text;
    if (!targetQ) return;
    const suggestion = await askCockpitAiAssist({
      interactionId: activeInteraction.id,
      customQuestion: targetQ,
    });
    setAdHocAssistResult(suggestion);
  };

  const displayedAiAssist: AIAssistSuggestion | undefined =
    adHocAssistResult ?? activeInteraction?.aiAssist;

  const stepSelectedDay = (delta: number) => {
    const idx = CALENDAR_WEEK_DATES.findIndex((d) => d.date === selectedDate);
    if (idx === -1) return;
    const nextIdx = Math.max(
      0,
      Math.min(CALENDAR_WEEK_DATES.length - 1, idx + delta)
    );
    setSelectedDate(CALENDAR_WEEK_DATES[nextIdx].date);
  };

  const statusToneClass = (status: AppointmentStatus) => {
    switch (status) {
      case "Confirmed":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "Checked In":
        return "text-teal-800 bg-teal-50 border-teal-200";
      case "Rescheduled":
        return "text-purple-800 bg-purple-50 border-purple-200";
      case "Cancelled":
        return "text-red-700 bg-red-50 border-red-200 line-through";
      case "Completed":
        return "text-slate-700 bg-slate-100 border-slate-200";
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Operational Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Selected Day Guest Bookings ({selectedDate})
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {kpiStats.activeTodayCount}{" "}
            <span className="text-xs font-normal font-sans text-slate-500">
              active · ${kpiStats.bookedRevenue.toLocaleString()} scheduled
            </span>
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Live Customer Conversations
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {kpiStats.liveCount}{" "}
            <span className="text-xs font-normal font-sans text-emerald-700">
              {kpiStats.liveChatCount} Chat · {kpiStats.liveVoiceCount} Voice
              Calls
            </span>
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Tough Questions Flagged for AI Assist
          </div>
          <div className="text-xl font-bold text-purple-800 font-mono tabular-nums">
            {kpiStats.toughCount}{" "}
            <span className="text-xs font-normal font-sans text-slate-600">
              live policy &amp; clinical escalations
            </span>
          </div>
        </div>

        <div className="p-4 space-y-1 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-500">
            Calendar Changes &amp; Workspace Layout
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs font-mono tabular-nums text-slate-800">
              {kpiStats.rescheduledCount} Rescheduled ·{" "}
              {kpiStats.cancelledCount} Cancelled
            </span>
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-200 rounded-md">
              <button
                type="button"
                onClick={() => setWorkspaceLayout("split")}
                title="Split View: Calendar + Console"
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  workspaceLayout === "split"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceLayout("calendar-full")}
                title="Full-Width Calendar View"
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  workspaceLayout === "calendar-full"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Calendar
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceLayout("console-full")}
                title="Full-Width Interaction Console"
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  workspaceLayout === "console-full"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Console
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Cockpit Grid: Guest Appointments Calendar + Manager Customer Interaction Console */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT / CALENDAR PANE ================= */}
        {workspaceLayout !== "console-full" && (
          <section
            aria-label="Guest Appointments Calendar"
            className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
              workspaceLayout === "calendar-full"
                ? "xl:col-span-12"
                : "xl:col-span-7"
            }`}
          >
            {/* Calendar Header & Filters */}
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-700 shrink-0" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Guest Appointments Calendar
                  </h2>
                  <span className="text-xs text-slate-500">
                    · Reschedule or cancel directly from customer interactions
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCalendarMode("day")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                        calendarMode === "day"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Day Timeline
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMode("week")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap inline-flex items-center gap-1 ${
                        calendarMode === "week"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <LayoutGrid className="w-3 h-3" />
                      7-Day Week
                    </button>
                  </div>

                  {workspaceLayout === "split" ? (
                    <button
                      type="button"
                      onClick={() => setWorkspaceLayout("calendar-full")}
                      title="Expand Calendar"
                      className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWorkspaceLayout("split")}
                      className="px-2.5 py-1 text-xs font-medium text-purple-800 bg-purple-50 border border-purple-200 rounded-md whitespace-nowrap"
                    >
                      Show Live Console
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={calendarSearch}
                    onChange={(e) => setCalendarSearch(e.target.value)}
                    placeholder="Search guest, stylist, service..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    aria-label="Filter appointments by studio"
                    value={salonFilter}
                    onChange={(e) => setSalonFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-purple-600"
                  >
                    <option value="ALL">
                      All Authorized Salons ({authorizedSalons.length})
                    </option>
                    {authorizedSalons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <select
                    aria-label="Filter appointments by status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value as AppointmentStatus | "ALL"
                      )
                    }
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-purple-600"
                  >
                    <option value="ALL">All Status</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Checked In">Checked In</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      setOnlyWithInteractions(!onlyWithInteractions)
                    }
                    className={`w-full px-2 py-1.5 text-[11px] font-medium border rounded-md transition-colors whitespace-nowrap truncate ${
                      onlyWithInteractions
                        ? "bg-purple-50 border-purple-300 text-purple-900"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {onlyWithInteractions ? "✓ With Chat/Call" : "Chat/Call Link"}
                  </button>
                </div>
              </div>

              {/* 7-Day Date Strip */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => stepSelectedDay(-1)}
                  aria-label="Previous day"
                  className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 grid grid-cols-7 gap-1 min-w-[420px]">
                  {CALENDAR_WEEK_DATES.map((d) => {
                    const count = baseFilteredAppointments.filter(
                      (a) => a.date === d.date && a.status !== "Cancelled"
                    ).length;
                    const isSelected = selectedDate === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d.date);
                          setCalendarMode("day");
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={
                              isSelected ? "text-slate-300" : "text-slate-500"
                            }
                          >
                            {d.dayShort}
                          </span>
                          {d.isToday && (
                            <span
                              className={`font-semibold ${
                                isSelected
                                  ? "text-purple-300"
                                  : "text-purple-700"
                              }`}
                            >
                              Today
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between gap-1 mt-0.5">
                          <span className="text-xs font-bold font-mono tabular-nums">
                            {d.monthShort} {d.dayNum}
                          </span>
                          <span
                            className={`text-[10px] font-mono tabular-nums ${
                              isSelected ? "text-purple-200" : "text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => stepSelectedDay(1)}
                  aria-label="Next day"
                  className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Calendar Body: Day Timeline View OR 7-Day Week Grid View */}
            {calendarMode === "day" ? (
              <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
                {dayAppointments.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <div className="text-sm font-semibold text-slate-800">
                      No guest appointments match filters on {selectedDate}
                    </div>
                    <p className="text-xs text-slate-500">
                      Switch calendar dates above or clear studio/status filters
                      to view all scheduled guests.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSalonFilter("ALL");
                        setStatusFilter("ALL");
                        setOnlyWithInteractions(false);
                        setCalendarSearch("");
                        setSelectedDate("2026-10-25");
                      }}
                      className="mt-2 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md"
                    >
                      Reset Calendar Filters
                    </button>
                  </div>
                ) : (
                  dayAppointments.map((apt) => {
                    const isSelected = selectedAppointmentId === apt.id;
                    const linkedInter = apt.linkedInteractionId
                      ? interactions.find(
                          (i) => i.id === apt.linkedInteractionId
                        )
                      : undefined;
                    const canModify =
                      apt.status !== "Cancelled" && apt.status !== "Completed";

                    return (
                      <div
                        key={apt.id}
                        onClick={() => handleSelectAppointmentCard(apt)}
                        className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-purple-50/60"
                            : "hover:bg-slate-50/90"
                        }`}
                      >
                        {/* Time Column */}
                        <div className="sm:w-28 shrink-0 space-y-0.5">
                          <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                            {formatTime12h(apt.startTime)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {apt.durationMin}m · {apt.chairLabel}
                          </div>
                          <div className="pt-1">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold border rounded ${statusToneClass(
                                apt.status
                              )}`}
                            >
                              {apt.status}
                            </span>
                          </div>
                        </div>

                        {/* Guest, Service & Linked Interaction Context */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900">
                              {apt.guestName}
                            </span>
                            <span className="text-xs text-slate-500">
                              · {apt.membershipTier} ·{" "}
                              <span className="font-mono tabular-nums">
                                {apt.id}
                              </span>
                            </span>
                          </div>

                          <div className="text-xs font-medium text-slate-800">
                            {apt.serviceName}{" "}
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              (${apt.priceUsd})
                            </span>
                          </div>

                          <div className="text-xs text-slate-600">
                            {apt.salonName} · Stylist: {apt.stylistName}
                          </div>

                          {linkedInter && (
                            <div className="mt-1.5 p-2 rounded-lg bg-white border border-purple-200 text-[11px] text-slate-700 flex items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="font-semibold text-purple-900 flex flex-wrap items-center gap-1.5">
                                  {linkedInter.channel === "Voice" ? (
                                    <Phone className="w-3 h-3 text-purple-700 shrink-0" />
                                  ) : (
                                    <MessageSquare className="w-3 h-3 text-purple-700 shrink-0" />
                                  )}
                                  <span>
                                    {linkedInter.lifecycle}{" "}
                                    {linkedInter.channel === "Voice"
                                      ? "Voice Transcript"
                                      : "Customer Chat"}
                                  </span>
                                  <span>·</span>
                                  <span>{linkedInter.topic}</span>
                                </div>
                                {apt.interactionSummary && (
                                  <div className="text-slate-600">
                                    {apt.interactionSummary}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectInteractionRow(linkedInter);
                                  if (workspaceLayout === "calendar-full") {
                                    setWorkspaceLayout("split");
                                  }
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded shrink-0 whitespace-nowrap"
                              >
                                View in Console
                              </button>
                            </div>
                          )}

                          {apt.lastActionNote && (
                            <div className="text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded px-2 py-1 mt-1">
                              {apt.lastActionNote}
                            </div>
                          )}
                        </div>

                        {/* Direct Calendar Actions: Reschedule & Cancel */}
                        <div
                          className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canModify ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openRescheduleModal(apt)}
                                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md whitespace-nowrap w-full sm:w-auto text-center"
                              >
                                Reschedule
                              </button>
                              <button
                                type="button"
                                onClick={() => openCancelModal(apt)}
                                className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-red-50 text-red-700 border border-slate-300 hover:border-red-300 rounded-md whitespace-nowrap w-full sm:w-auto text-center"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(apt)}
                              className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md whitespace-nowrap"
                            >
                              Rebook Slot
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* 7-Day Week Calendar Grid View */
              <div className="p-3 overflow-x-auto">
                <div className="grid grid-cols-7 gap-2 min-w-[820px]">
                  {CALENDAR_WEEK_DATES.map((d) => {
                    const colAppointments = baseFilteredAppointments.filter(
                      (a) => a.date === d.date
                    );
                    return (
                      <div
                        key={d.date}
                        className={`border rounded-lg flex flex-col min-h-[420px] ${
                          d.date === selectedDate
                            ? "border-purple-400 bg-purple-50/20"
                            : "border-slate-200 bg-slate-50/40"
                        }`}
                      >
                        <div className="px-2.5 py-2 border-b border-slate-200 bg-white rounded-t-lg flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">
                            {d.dayShort}{" "}
                            <span className="font-mono tabular-nums">
                              {d.dayNum}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-500">
                            {colAppointments.length} slots
                          </span>
                        </div>

                        <div className="p-1.5 space-y-1.5 flex-1">
                          {colAppointments.map((apt) => {
                            const canModify =
                              apt.status !== "Cancelled" &&
                              apt.status !== "Completed";
                            return (
                              <div
                                key={apt.id}
                                onClick={() => handleSelectAppointmentCard(apt)}
                                className={`p-2 rounded border bg-white text-[11px] space-y-1 cursor-pointer transition-colors ${
                                  selectedAppointmentId === apt.id
                                    ? "border-purple-600 ring-1 ring-purple-600/30"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 font-mono tabular-nums">
                                  <span className="font-bold text-slate-900">
                                    {formatTime12h(apt.startTime)}
                                  </span>
                                  <span
                                    className={`px-1 py-0.2 text-[9px] font-semibold border rounded ${statusToneClass(
                                      apt.status
                                    )}`}
                                  >
                                    {apt.status}
                                  </span>
                                </div>
                                <div className="font-semibold text-slate-900 truncate">
                                  {apt.guestName}
                                </div>
                                <div className="text-slate-600 truncate">
                                  {apt.serviceName}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {apt.salonName}
                                </div>
                                {canModify && (
                                  <div
                                    className="pt-1 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => openRescheduleModal(apt)}
                                      className="flex-1 px-1.5 py-0.5 text-[10px] font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                                    >
                                      Move
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openCancelModal(apt)}
                                      className="px-1.5 py-0.5 text-[10px] font-medium text-red-700 border border-slate-200 rounded hover:bg-red-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================= RIGHT / MANAGER INTERACTION CONSOLE + AI ASSIST ================= */}
        {workspaceLayout !== "calendar-full" && (
          <section
            aria-label="Customer Interaction Console and AI Assist"
            className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col ${
              workspaceLayout === "console-full"
                ? "xl:col-span-12"
                : "xl:col-span-5"
            }`}
          >
            {/* Console Header */}
            <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-900 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-purple-300 shrink-0" />
                  <h2 className="text-sm font-bold tracking-tight">
                    Customer Interaction Console &amp; AI Assist
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {workspaceLayout === "split" ? (
                    <button
                      type="button"
                      onClick={() => setWorkspaceLayout("console-full")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md whitespace-nowrap"
                    >
                      Expand Console
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWorkspaceLayout("split")}
                      className="px-2.5 py-1 text-[11px] font-medium bg-purple-700 hover:bg-purple-600 text-white rounded-md whitespace-nowrap"
                    >
                      Show Calendar Split View
                    </button>
                  )}
                </div>
              </div>

              {/* Live vs Previous + Chat vs Voice Transcript Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center p-0.5 bg-slate-800 border border-slate-700 rounded-lg">
                  {(
                    [
                      { id: "Live", label: "Live Conversations" },
                      { id: "Previous", label: "Previous History" },
                      { id: "ALL", label: "All" },
                    ] as const
                  ).map((tab) => {
                    const count =
                      tab.id === "ALL"
                        ? interactions.length
                        : interactions.filter((i) => i.lifecycle === tab.id)
                            .length;
                    const active = lifecycleFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setLifecycleFilter(tab.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? "bg-purple-600 text-white"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        {tab.label} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="inline-flex items-center p-0.5 bg-slate-800 border border-slate-700 rounded-lg">
                  {(
                    [
                      { id: "ALL", label: "All" },
                      { id: "Chat", label: "Chat" },
                      { id: "Voice", label: "Voice Transcripts" },
                    ] as const
                  ).map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setChannelFilter(ch.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        channelFilter === ch.id
                          ? "bg-white text-slate-900"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={consoleSearch}
                  onChange={(e) => setConsoleSearch(e.target.value)}
                  placeholder="Search chat messages, voice transcripts, or guest name..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Console Body: Responsive Split when Expanded, Stacked Queue + Active Stream when Docked */}
            <div
              className={
                workspaceLayout === "console-full"
                  ? "grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
                  : "divide-y divide-slate-200"
              }
            >
              {/* Conversation Selector Queue */}
              <div
                className={
                  workspaceLayout === "console-full"
                    ? "lg:col-span-4 max-h-[700px] overflow-y-auto divide-y divide-slate-100"
                    : "max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/70"
                }
              >
                {filteredInteractions.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-500">
                    No customer conversations match current filters.
                  </div>
                ) : (
                  filteredInteractions.map((inter) => {
                    const selected = activeInteraction?.id === inter.id;
                    return (
                      <button
                        key={inter.id}
                        type="button"
                        onClick={() => handleSelectInteractionRow(inter)}
                        className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-start justify-between gap-2 ${
                          selected
                            ? "bg-purple-50/90"
                            : "hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            {inter.channel === "Voice" ? (
                              <Phone className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900 truncate">
                              {inter.guestName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              · {inter.lifecycle} {inter.channel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-700 truncate">
                            {inter.topic}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {inter.salonName} ·{" "}
                            <span className="font-mono tabular-nums">
                              {inter.startedAt}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right space-y-1">
                          {inter.hasToughQuestion && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                              Tough Q
                            </span>
                          )}
                          <div className="text-[10px] font-mono tabular-nums text-slate-500">
                            {inter.linkedAppointmentId ?? ""}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Selected Conversation Transcript + AI Assist + Reply Composer */}
              {activeInteraction ? (
                <div
                  className={
                    workspaceLayout === "console-full"
                      ? "lg:col-span-8 flex flex-col"
                      : "flex flex-col"
                  }
                >
                  {/* Active Stream Metadata & Linked Guest Appointment Bar */}
                  <div className="p-3.5 bg-white border-b border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                          <span>{activeInteraction.guestName}</span>
                          <span className="font-normal text-slate-500">
                            · {activeInteraction.membershipTier} ·{" "}
                            <span className="font-mono tabular-nums">
                              {activeInteraction.guestPhone}
                            </span>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {activeInteraction.salonName} ·{" "}
                          <span className="font-semibold text-purple-800">
                            {activeInteraction.durationOrStatusLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          simulateIncomingCustomerTurn(activeInteraction.id)
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Simulate Live Customer Turn
                      </button>
                    </div>

                    {/* Linked Guest Appointment Action Bar inside Console */}
                    {linkedAppointmentForConsole && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] space-y-0.5">
                          <div className="font-semibold text-slate-900">
                            Linked Booking:{" "}
                            <span className="font-mono tabular-nums">
                              {linkedAppointmentForConsole.id}
                            </span>{" "}
                            · {linkedAppointmentForConsole.serviceName} (
                            <span className="font-mono tabular-nums">
                              ${linkedAppointmentForConsole.priceUsd}
                            </span>
                            )
                          </div>
                          <div className="text-slate-600 font-mono tabular-nums">
                            {linkedAppointmentForConsole.date} ·{" "}
                            {formatTime12h(
                              linkedAppointmentForConsole.startTime
                            )}{" "}
                            · {linkedAppointmentForConsole.stylistName} ·{" "}
                            <span className="font-semibold">
                              {linkedAppointmentForConsole.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openRescheduleModal(linkedAppointmentForConsole)
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-md whitespace-nowrap"
                          >
                            Reschedule
                          </button>
                          {linkedAppointmentForConsole.status !==
                            "Cancelled" && (
                            <button
                              type="button"
                              onClick={() =>
                                openCancelModal(linkedAppointmentForConsole)
                              }
                              className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-red-50 text-red-700 border border-slate-300 rounded-md whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat / Voice Transcript Messages */}
                  <div className="p-3.5 space-y-2.5 max-h-[270px] overflow-y-auto bg-slate-50/50">
                    {activeInteraction.turns.map((turn) => {
                      const isManager = turn.speaker === "Manager";
                      const isSystem = turn.speaker === "System";
                      return (
                        <div
                          key={turn.id}
                          className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                            isSystem
                              ? "bg-slate-100 border-slate-200 text-slate-600"
                              : isManager
                                ? "bg-purple-50/70 border-purple-200 text-slate-900 ml-4"
                                : turn.isToughQuestion
                                  ? "bg-amber-50/70 border-amber-300 text-slate-900 mr-4"
                                  : "bg-white border-slate-200 text-slate-900 mr-4"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-700">
                              {turn.speakerLabel}
                            </span>
                            <div className="flex items-center gap-2">
                              {turn.isToughQuestion && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRefreshConversationAiAssist(turn.text)
                                  }
                                  className="text-amber-900 font-semibold underline hover:text-purple-800"
                                >
                                  Tough Question · Ask AI Assist
                                </button>
                              )}
                              <span className="font-mono tabular-nums">
                                {turn.timestamp}
                              </span>
                            </div>
                          </div>
                          <p className="leading-relaxed">{turn.text}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Assist Panel for Tough Customer Questions */}
                  <div className="p-3.5 bg-purple-50/70 border-t border-b border-purple-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950">
                        <Sparkles className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>AI Assist · Tough Question Advisor</span>
                        {displayedAiAssist && (
                          <span className="font-normal text-[11px] text-purple-800">
                            · {displayedAiAssist.generatedBy}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={aiAssistLoading}
                        onClick={() => handleRefreshConversationAiAssist()}
                        className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 rounded inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${
                            aiAssistLoading ? "animate-spin" : ""
                          }`}
                        />
                        {aiAssistLoading
                          ? "Generating Answer..."
                          : "Refresh AI Assist"}
                      </button>
                    </div>

                    {policy.advisorPaused && (
                      <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          Customer Admin paused live LLM calls in Settings;
                          showing Certified Salon Policy Handbook answer.
                        </span>
                      </div>
                    )}

                    {displayedAiAssist && (
                      <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-2 text-xs">
                        <div className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            Question Analyzed:
                          </span>{" "}
                          &ldquo;{displayedAiAssist.toughQuestion}&rdquo;
                        </div>

                        <div className="text-slate-900 leading-relaxed bg-purple-50/40 p-2.5 rounded border border-purple-100">
                          <span className="font-semibold text-purple-950">
                            Suggested Answer:{" "}
                          </span>
                          {displayedAiAssist.suggestedAnswer}
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-700">
                          <div className="font-semibold text-slate-800">
                            Policy Basis ({displayedAiAssist.policyReference}):
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {displayedAiAssist.keyPolicyPoints.map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                          <span className="text-[11px] font-medium text-purple-900">
                            Action: {displayedAiAssist.recommendedActionSummary}
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setReplyDraft(displayedAiAssist.suggestedAnswer)
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded"
                            >
                              Use Answer in Reply
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                sendConsoleManagerReply(
                                  activeInteraction.id,
                                  displayedAiAssist.suggestedAnswer
                                )
                              }
                              className="px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3 text-emerald-700" />
                              Send Answer Now
                            </button>
                            {linkedAppointmentForConsole &&
                              displayedAiAssist.recommendedDate && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openRescheduleModal(
                                      linkedAppointmentForConsole,
                                      {
                                        date: displayedAiAssist.recommendedDate,
                                        time: displayedAiAssist.recommendedTime,
                                        stylist:
                                          displayedAiAssist.recommendedStylist,
                                        reason: `AI Assist (${displayedAiAssist.policyReference}): ${displayedAiAssist.recommendedActionSummary}`,
                                      }
                                    )
                                  }
                                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded"
                                >
                                  Apply Recommended Slot
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* On-Demand Tough Question Input for Manager */}
                    <form
                      onSubmit={handleAskCustomAiAssist}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={customToughQuestion}
                        onChange={(e) => setCustomToughQuestion(e.target.value)}
                        placeholder="Ask AI Assist any tough customer question (refund, allergy, fee, credit)..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-purple-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600"
                      />
                      <button
                        type="submit"
                        disabled={
                          aiAssistLoading || !customToughQuestion.trim()
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold bg-purple-800 hover:bg-purple-900 text-white rounded-md disabled:opacity-40 whitespace-nowrap"
                      >
                        Ask AI Assist
                      </button>
                    </form>
                  </div>

                  {/* Manager Live Reply Composer */}
                  <form
                    onSubmit={handleSendManagerReply}
                    className="p-3 bg-white flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={`Reply to ${activeInteraction.guestName} (${activeInteraction.channel})...`}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-purple-600"
                    />
                    <button
                      type="submit"
                      disabled={!replyDraft.trim()}
                      className="px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>

      {/* ================= RESCHEDULE APPOINTMENT MODAL ================= */}
      {rescheduleTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule Guest Appointment"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reschedule Guest Appointment ·{" "}
                  <span className="font-mono tabular-nums">
                    {rescheduleTarget.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {rescheduleTarget.guestName} · {rescheduleTarget.salonName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  Current Slot: {rescheduleTarget.date} at{" "}
                  <span className="font-mono tabular-nums">
                    {formatTime12h(rescheduleTarget.startTime)}
                  </span>{" "}
                  ({rescheduleTarget.durationMin}m · $
                  {rescheduleTarget.priceUsd})
                </div>
                <div className="text-slate-600">
                  Service: {rescheduleTarget.serviceName}
                </div>
                {rescheduleTarget.interactionSummary && (
                  <div className="text-purple-900 pt-1">
                    Interaction Context: {rescheduleTarget.interactionSummary}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    New Date
                  </label>
                  <select
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums"
                  >
                    {CALENDAR_WEEK_DATES.map((d) => (
                      <option key={d.date} value={d.date}>
                        {d.date} ({d.dayShort} {d.monthShort} {d.dayNum}
                        {d.isToday ? " · Today" : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assigned Stylist / Specialist
                  </label>
                  <select
                    value={rescheduleStylist}
                    onChange={(e) => setRescheduleStylist(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {getStylistsForSalon(rescheduleTarget.salonId).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Available Time Slot
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {BOOKING_TIME_SLOTS.map((slot) => {
                    const busyConflict = appointments.some(
                      (a) =>
                        a.id !== rescheduleTarget.id &&
                        a.salonId === rescheduleTarget.salonId &&
                        a.date === rescheduleDate &&
                        a.startTime === slot &&
                        a.status !== "Cancelled"
                    );
                    const selected = rescheduleTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setRescheduleTime(slot)}
                        className={`px-2 py-1.5 text-[11px] font-mono tabular-nums rounded border transition-colors ${
                          selected
                            ? "bg-purple-700 text-white border-purple-700 font-semibold"
                            : busyConflict
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Interaction Reason
                </label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rescheduleWaiveFee}
                  onChange={(e) => setRescheduleWaiveFee(e.target.checked)}
                  className="rounded border-slate-300 text-purple-700"
                />
                <span>
                  Waive $65 late-modification fee (Policy §4.2 Courtesy / VIP
                  Waiver)
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Keep Current Slot
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CANCEL APPOINTMENT MODAL ================= */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancel Guest Appointment"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cancel Guest Appointment ·{" "}
                  <span className="font-mono tabular-nums">
                    {cancelTarget.id}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {cancelTarget.guestName} · {cancelTarget.salonName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-red-50/70 border border-red-200 text-xs space-y-1 text-slate-800">
                <div className="font-semibold text-red-900">
                  Cancelling: {cancelTarget.serviceName} ($
                  {cancelTarget.priceUsd})
                </div>
                <div className="font-mono tabular-nums text-slate-700">
                  {cancelTarget.date} at{" "}
                  {formatTime12h(cancelTarget.startTime)} ·{" "}
                  {cancelTarget.stylistName}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Interaction Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelWaiveFee}
                  onChange={(e) => setCancelWaiveFee(e.target.checked)}
                  className="rounded border-slate-300 text-purple-700"
                />
                <span>
                  Waive $65 late-cancellation fee (Clinical / Travel / VIP
                  Courtesy)
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
