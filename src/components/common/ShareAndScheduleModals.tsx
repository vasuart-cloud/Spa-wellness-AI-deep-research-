import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  Lock,
  Send,
  X,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { METRIC_DEFINITIONS } from "../../services/syntheticDataService";
import { ScheduleConfig } from "../../types/domain";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  reportTitle: string;
  reportType: string;
  defaultSummary: string;
}

export const ShareReportModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
  reportTitle,
  reportType,
  defaultSummary,
}) => {
  const { policy, sendSimulatedShare } = useAppState();
  const [channel, setChannel] = useState<"Email" | "WhatsApp" | "SMS">("Email");
  const [recipient, setRecipient] = useState<string>(
    policy.approvedRecipients[0] ?? "regional.ops@elevatewellness.example"
  );
  const [customNote, setCustomNote] = useState<string>(defaultSummary);
  const [resultBanner, setResultBanner] = useState<{
    ok: boolean;
    text: string;
    secureUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setCustomNote(defaultSummary);
      setResultBanner(null);
      if (
        policy.approvedRecipients.length > 0 &&
        !policy.approvedRecipients.includes(recipient)
      ) {
        setRecipient(policy.approvedRecipients[0]);
      }
    }
  }, [open, defaultSummary, reportTitle, policy.approvedRecipients]);

  if (!open) return null;

  const channelAllowed =
    policy.sharingEnabled && policy.allowedExportChannels.includes(channel);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const res = sendSimulatedShare({
      channel,
      recipient: recipient.trim(),
      subject: `InsightFlow Report: ${reportTitle}`,
      bodyPreview: customNote,
      reportType,
    });
    if (res.ok && res.message) {
      setResultBanner({
        ok: true,
        text: res.message.deliveryBanner,
        secureUrl: res.message.secureLinkUrl,
      });
    } else {
      setResultBanner({
        ok: false,
        text: res.error ?? "Delivery blocked by tenant governance policy.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Share Certified Report (Simulated Outbox)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Generates a role-scoped 24-hour expiring link · Recorded in Tenant Audit Log
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Delivery Channel
            </label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(["Email", "WhatsApp", "SMS"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChannel(ch);
                    setResultBanner(null);
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    channel === ch
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {ch === "SMS" ? "SMS (Alerts)" : ch}
                </button>
              ))}
            </div>
            {!channelAllowed && (
              <p className="text-xs text-amber-800 mt-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {!policy.sharingEnabled
                    ? "External report sharing is currently disabled in AI Governance."
                    : `Channel "${channel}" is currently blocked by tenant export policy.`}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Recipient Address (Governed Allowlist Enforced)
            </label>
            <input
              type="email"
              required
              list="approved-recipients-datalist"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setResultBanner(null);
              }}
              placeholder="Select approved recipient or enter email..."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-teal-600"
            />
            <datalist id="approved-recipients-datalist">
              {policy.approvedRecipients.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span>Approved:</span>
              {policy.approvedRecipients.map((r, idx) => (
                <React.Fragment key={r}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setRecipient(r);
                      setResultBanner(null);
                    }}
                    className={`font-mono hover:text-teal-800 underline-offset-2 ${
                      recipient.trim().toLowerCase() === r.toLowerCase()
                        ? "text-teal-800 font-semibold underline"
                        : "text-slate-600"
                    }`}
                  >
                    {r}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Message Preview
            </label>
            <textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>
              Sensitive metrics are shared via expiring 24h role-scoped link rather than raw attachment.
            </span>
          </div>

          {resultBanner && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1 ${
                resultBanner.ok
                  ? "bg-teal-50/70 border-teal-200 text-teal-950"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {resultBanner.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{resultBanner.text}</span>
              </div>
              {resultBanner.secureUrl && (
                <div className="font-mono text-xs text-slate-700 break-all">
                  Link: {resultBanner.secureUrl}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              Simulate {channel} Delivery
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialSchedule: ScheduleConfig | null;
  onSave: (schedule: ScheduleConfig) => void;
}

export const ScheduleConfigModal: React.FC<ScheduleModalProps> = ({
  open,
  onClose,
  title,
  initialSchedule,
  onSave,
}) => {
  const [cadence, setCadence] = useState<ScheduleConfig["cadence"]>(
    initialSchedule?.cadence ?? "Weekly"
  );
  const [dayOfWeek, setDayOfWeek] = useState<string>(
    initialSchedule?.dayOfWeek ?? "Monday"
  );
  const [timeLocal, setTimeLocal] = useState<string>(
    initialSchedule?.timeLocal ?? "08:00"
  );
  const [timezone, setTimezone] = useState<string>(
    initialSchedule?.timezone ?? "America/Los_Angeles"
  );

  useEffect(() => {
    if (open) {
      setCadence(initialSchedule?.cadence ?? "Weekly");
      setDayOfWeek(initialSchedule?.dayOfWeek ?? "Monday");
      setTimeLocal(initialSchedule?.timeLocal ?? "08:00");
      setTimezone(initialSchedule?.timezone ?? "America/Los_Angeles");
    }
  }, [open, initialSchedule]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      enabled: true,
      cadence,
      dayOfWeek: cadence === "Weekly" || cadence === "Custom" ? dayOfWeek : undefined,
      timeLocal,
      timezone,
      nextRunAt: `Next ${cadence} Window · ${timeLocal} (${timezone})`,
      lastRunAt: initialSchedule?.lastRunAt ?? null,
      lastRunStatus: initialSchedule?.lastRunStatus ?? "Pending",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Configure Recurring Analysis Schedule
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Refresh Cadence
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {(["Daily", "Weekly", "Monthly", "Custom"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCadence(c)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    cadence === c
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {(cadence === "Weekly" || cadence === "Custom") && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scheduled Day
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Local Execution Time
              </label>
              <input
                type="time"
                value={timeLocal}
                onChange={(e) => setTimeLocal(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="America/Phoenix">America/Phoenix</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Prototype note: Scheduled jobs persist in browser storage and can be tested interactively using{" "}
            <span className="font-semibold text-slate-800">Run Now</span> or{" "}
            <span className="font-semibold text-slate-800">Run Due Jobs</span> without claiming a background cron daemon.
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Save Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface MetricModalProps {
  open: boolean;
  onClose: () => void;
  metricIds?: string[];
}

export const MetricDefinitionsModal: React.FC<MetricModalProps> = ({
  open,
  onClose,
}) => {
  if (!open) return null;
  const defs = Object.values(METRIC_DEFINITIONS);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Certified Metric Catalog &amp; Calculation Lineage
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-700">
          Every chart, opportunity card, proactive alert, and AI Business Advisor response computes numbers from these shared metric definitions.
        </p>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {defs.map((d) => (
            <div key={d.id} className="p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  {d.name}
                </span>
                <span className="text-xs font-mono text-slate-600">
                  {d.id}@{d.version}
                </span>
              </div>
              <div className="text-xs font-mono text-teal-900 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                Formula: {d.formula}
              </div>
              <div className="text-xs text-slate-600">
                {d.businessMeaning} · <span className="text-slate-800 font-medium">{d.cadenceNote}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
