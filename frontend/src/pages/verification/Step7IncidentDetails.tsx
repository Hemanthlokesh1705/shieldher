import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { submitElicitationRound } from "../../services/api";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Step7IncidentDetails() {
  const navigate = useNavigate();
  const { activeCase, incidentAnswers, setIncidentAnswers } = useVerification();

  const [discoveryDate, setDiscoveryDate] = useState(
    incidentAnswers.discoveryDate || ""
  );
  const [platforms, setPlatforms] = useState<string[]>(
    incidentAnswers.platforms || []
  );
  const [relationship, setRelationship] = useState(
    incidentAnswers.relationship || "UNKNOWN"
  );
  const [threatType, setThreatType] = useState<string[]>(
    incidentAnswers.threatType || []
  );
  const [narrative, setNarrative] = useState(incidentAnswers.narrative || "");
  const [submitting, setSubmitting] = useState(false);

  const availablePlatforms = [
    "Telegram",
    "WhatsApp",
    "Instagram",
    "Reddit",
    "X / Twitter",
    "Discord",
    "Email or SMS",
    "Other platform",
  ];

  const availableThreats = [
    "Unauthorised image sharing",
    "Blackmail or extortion demands",
    "Impersonation or fake profile",
    "Online harassment or messages",
    "Threat of physical harm",
  ];

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const toggleThreat = (t: string) => {
    setThreatType((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      discoveryDate,
      platforms,
      relationship,
      threatType,
      narrative,
    };
    setIncidentAnswers(updated);

    if (activeCase) {
      setSubmitting(true);
      try {
        await submitElicitationRound(activeCase.id, 1, updated);
      } catch (_) {}
      finally {
        setSubmitting(false);
      }
    }

    navigate("/verification/evidence-review");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          7. Incident Information
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
          If you decide to prepare a formal complaint draft, these details help
          structure your narrative. All fields are completely optional and under
          your control.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Discovery Date */}
        <div>
          <label
            className="block text-xs font-bold text-ink font-heading mb-1.5"
            htmlFor="discovery-date"
          >
            When did you first become aware of this image or message?
          </label>
          <div className="relative max-w-xs">
            <input
              id="discovery-date"
              className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
              type="date"
              value={discoveryDate}
              onChange={(e) => setDiscoveryDate(e.target.value)}
            />
          </div>
        </div>

        {/* Platforms Selection */}
        <div>
          <label className="block text-xs font-bold text-ink font-heading mb-2">
            Where was the image seen or received?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {availablePlatforms.map((p) => {
              const selected = platforms.includes(p);
              return (
                <label
                  key={p}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none shadow-2xs",
                    selected
                      ? "bg-brand-sage/30 border-brand-forest text-brand-forest font-semibold ring-1 ring-brand-forest"
                      : "bg-[#FAF8F5] border-ink-border text-ink hover:bg-canvas-subtle"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => togglePlatform(p)}
                    className="rounded text-brand-forest focus:ring-brand-rich"
                  />
                  <span>{p}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Relationship */}
        <div>
          <label
            className="block text-xs font-bold text-ink font-heading mb-1.5"
            htmlFor="relationship"
          >
            Do you know who may be responsible?
          </label>
          <select
            id="relationship"
            className="w-full max-w-md h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="UNKNOWN">I do not know who is responsible</option>
            <option value="EX_PARTNER">Former partner</option>
            <option value="ACQUAINTANCE">
              Acquaintance, classmate, or colleague
            </option>
            <option value="STRANGER">Anonymous online user</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </div>

        {/* Nature of Situation */}
        <div>
          <label className="block text-xs font-bold text-ink font-heading mb-2">
            What is the nature of the situation?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {availableThreats.map((t) => {
              const selected = threatType.includes(t);
              return (
                <label
                  key={t}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none shadow-2xs",
                    selected
                      ? "bg-brand-sage/30 border-brand-forest text-brand-forest font-semibold ring-1 ring-brand-forest"
                      : "bg-[#FAF8F5] border-ink-border text-ink hover:bg-canvas-subtle"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleThreat(t)}
                    className="rounded text-brand-forest focus:ring-brand-rich"
                  />
                  <span>{t}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Narrative Freeform */}
        <div>
          <label
            className="block text-xs font-bold text-ink font-heading mb-1.5"
            htmlFor="narrative"
          >
            Additional notes or timeline (optional)
          </label>
          <textarea
            id="narrative"
            rows={4}
            className="w-full p-3.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="You can write down what happened in your own words. Specific details (such as account handles, timestamps, or messages) can be helpful if you decide to file a complaint."
          />
        </div>

        {/* Navigation Action Buttons */}
        <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={() => navigate("/verification/online-search")}
            disabled={submitting}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Online Search</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {submitting
                ? "Saving details…"
                : "Continue to Evidence Review"}
            </span>
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
