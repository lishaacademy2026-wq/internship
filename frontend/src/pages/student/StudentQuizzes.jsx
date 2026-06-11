import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";

const StudentQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [taking, setTaking] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/quizzes/my");
      setQuizzes(data.quizzes || []);
    } catch (err) {
      console.error("Failed to load quizzes", err);
    } finally {
      setLoading(false);
    }
  };

  const canTake = (quiz) => {
    const submission = quiz.submissions?.[0];
    if (!submission) return true;
    if (quiz.maxAttempts === 1) return false; // Can't retake if maxAttempts is 1
    return true;
  };

  const handleSelectAnswer = (questionIndex, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const { data } = await api.post(`/api/quizzes/${taking._id}/submit`, { answers: Object.values(answers) });
      setShowResults(data.submission);
      setTaking(null);
      setAnswers({});
      loadQuizzes();
    } catch (err) {
      setSubmitError(err?.response?.data?.message || "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const getQuizStatus = (quiz) => {
    const submission = quiz.submissions?.[0];
    if (!submission) return "not_taken";
    return submission.passed ? "passed" : "failed";
  };

  return (
    <DashboardLayout title="My Quizzes">
      <div className="quiz-header">
        <div>
          <h2>My Quizzes</h2>
          <p>Complete quizzes to test your knowledge</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <h3>No quizzes available</h3>
          <p>Your instructors will add quizzes soon.</p>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map((quiz) => {
            const status = getQuizStatus(quiz);
            const submission = quiz.submissions?.[0];
            const canTakeQuiz = canTake(quiz);

            return (
              <div key={quiz._id} className="quiz-card">
                <div className="quiz-card__header">
                  <h3>{quiz.title}</h3>
                  <span className={`quiz-status quiz-status--${status}`}>
                    {status === "passed"
                      ? "✓ Passed"
                      : status === "failed"
                      ? "✗ Failed"
                      : "○ Not Taken"}
                  </span>
                </div>

                <p className="quiz-card__description">{quiz.description}</p>

                <div className="quiz-card__details">
                  <div className="detail-item">
                    <span className="detail-label">Questions:</span>
                    <span className="detail-value">{quiz.questions?.length || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Passing Score:</span>
                    <span className="detail-value">{quiz.passingScore}%</span>
                  </div>
                  {submission && (
                    <div className="detail-item">
                      <span className="detail-label">Your Score:</span>
                      <span className={`detail-value ${submission.passed ? "score-passed" : "score-failed"}`}>
                        {submission.score}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="quiz-card__actions">
                  {!submission ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setTaking(quiz)}
                    >
                      Take Quiz
                    </button>
                  ) : canTakeQuiz ? (
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => setTaking(quiz)}
                    >
                      Retake Quiz
                    </button>
                  ) : (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
                      No retakes allowed
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz Taking Modal */}
      {taking && (
        <div className="modal-overlay" role="presentation" style={{ zIndex: 1000 }}>
          <div
            className="modal-card quiz-taking-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="quiz-modal-title"
            style={{ maxWidth: "700px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header sticky-header">
              <h3 id="quiz-modal-title">Quiz: {taking.title}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setTaking(null)}
                title="Close quiz"
              >
                ✕
              </button>
            </div>

            <div className="modal-body quiz-questions">
              {taking.questions?.map((question, qIndex) => (
                <div key={qIndex} className="quiz-question">
                  <h4>Question {qIndex + 1}</h4>
                  <p className="question-text">{question.question}</p>

                  <div className="question-options">
                    {question.options?.map((option, oIndex) => (
                      <label key={oIndex} className="option-label">
                        <input
                          type="radio"
                          name={`question-${qIndex}`}
                          value={oIndex}
                          checked={answers[qIndex] === oIndex}
                          onChange={() => handleSelectAnswer(qIndex, oIndex)}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {submitError && <div className="form-error" style={{ marginTop: "20px" }}>{submitError}</div>}
            </div>

            <div className="modal-footer sticky-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(answers).length !== taking.questions?.length}
              >
                {submitting ? "Submitting..." : "Submit Quiz"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setTaking(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && (
        <div className="modal-overlay" onClick={() => setShowResults(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="results-title"
            style={{ maxWidth: "500px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="results-title">Quiz Results</h3>
            </div>

            <div className="modal-body" style={{ textAlign: "center" }}>
              <div
                className={`quiz-result-badge ${showResults.passed ? "passed" : "failed"}`}
                style={{
                  fontSize: "48px",
                  fontWeight: "bold",
                  marginBottom: "16px",
                }}
              >
                {showResults.passed ? "✓ Passed" : "✗ Failed"}
              </div>

              <div className="result-score" style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
                {showResults.score}%
              </div>

              {showResults.canViewAnswers && (
                <div style={{ marginTop: "24px", textAlign: "left" }}>
                  <h4>Review Your Answers:</h4>
                  {taking.questions?.map((q, idx) => (
                    <div key={idx} style={{ padding: "12px", borderLeft: "2px solid var(--green-500)", marginBottom: "12px" }}>
                      <p style={{ fontWeight: 500 }}>{q.question}</p>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Your answer: {q.options?.[showResults.answers?.[idx]]}</p>
                      <p style={{ fontSize: "13px", color: "var(--green-600)", fontWeight: 500 }}>Correct: {q.options?.[q.correctIndex]}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setShowResults(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentQuizzes;