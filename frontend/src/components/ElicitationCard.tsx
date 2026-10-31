import React, { useState, useEffect } from "react";
import { ElicitationQuestion, ElicitationQuestionsResponse } from "../types/models";
import { getElicitationQuestions, submitElicitationRound } from "../services/api";

interface ElicitationCardProps {
  caseId: string;
  onCompleted: () => void;
}

export const ElicitationCard: React.FC<ElicitationCardProps> = ({ caseId, onCompleted }) => {
  const [currentRound, setCurrentRound] = useState(1);
  const [questionsData, setQuestionsData] = useState<ElicitationQuestionsResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRound(currentRound);
  }, [currentRound, caseId]);

  const loadRound = async (round: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getElicitationQuestions(caseId, round);
      setQuestionsData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load elicitation questions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (fieldKey: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  const handleNextRound = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await submitElicitationRound(caseId, currentRound, answers);
      if (questionsData?.is_last_round || currentRound >= 3) {
        onCompleted();
      } else {
        setCurrentRound((r) => r + 1);
        setAnswers({});
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit answers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipQuestion = (fieldKey: string) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldKey]: "SKIPPED",
    }));
  };

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#059669" }}>
            📝
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              6. Structured Incident Elicitation
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)" }}>
              Gathering factual incident context for the formal legal complaint draft
            </p>
          </div>
        </div>
        <span className="badge-clean badge-emerald">
          <span className="status-dot-emerald" /> Round {currentRound} of 3
        </span>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem", lineHeight: 1.55 }}>
        All questions are optional and skippable. No personal images or intimate descriptions are ever sent to an external language model.
      </p>

      {error && (
        <div
          className="animate-fade-in"
          style={{
            backgroundColor: "var(--color-error-bg)",
            color: "var(--color-error)",
            border: "1px solid #fecaca",
            padding: "0.85rem 1rem",
            borderRadius: "10px",
            marginBottom: "1.25rem",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span> <span>{error}</span>
        </div>
      )}

      {isLoading && !questionsData ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Loading interview questions...</p>
      ) : (
        <form onSubmit={handleNextRound}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.75rem" }}>
            {questionsData?.questions.map((q: ElicitationQuestion) => (
              <div
                key={q.question_id}
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "1.25rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.4 }}>
                    {q.prompt}
                  </label>
                  {q.is_optional && (
                    <button
                      type="button"
                      onClick={() => handleSkipQuestion(q.field_key)}
                      style={{
                        fontSize: "0.75rem",
                        color: "#059669",
                        backgroundColor: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        marginLeft: "0.75rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Skip this
                    </button>
                  )}
                </div>

                {q.helper_text && (
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                    {q.helper_text}
                  </p>
                )}

                {q.input_type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={answers[q.field_key] || ""}
                    onChange={(e) => handleInputChange(q.field_key, e.target.value)}
                    placeholder="Enter incident context here..."
                    className="textarea-clean"
                  />
                ) : q.input_type === "select" && q.options ? (
                  <select
                    value={answers[q.field_key] || ""}
                    onChange={(e) => handleInputChange(q.field_key, e.target.value)}
                    className="select-clean"
                  >
                    <option value="">-- Select an option --</option>
                    {q.options.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : q.input_type === "date" ? (
                  <input
                    type="date"
                    value={answers[q.field_key] || ""}
                    onChange={(e) => handleInputChange(q.field_key, e.target.value)}
                    className="input-clean"
                  />
                ) : (
                  <input
                    type="text"
                    value={answers[q.field_key] || ""}
                    onChange={(e) => handleInputChange(q.field_key, e.target.value)}
                    placeholder="Your answer..."
                    className="input-clean"
                  />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              🔒 Answers stored securely in encrypted case persistence
            </span>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-emerald"
              style={{ padding: "0.85rem 1.75rem" }}
            >
              {isLoading
                ? "Saving..."
                : questionsData?.is_last_round || currentRound >= 3
                ? "Finish & Proceed to Complaint Draft"
                : "Next Round →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
