import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";

const InstructorQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    questions: [{ question: "", options: ["", "", "", ""], correctIndex: 0 }],
    passingScore: 70,
    maxAttempts: 1,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewingSubmissions, setViewingSubmissions] = useState(null);

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

  const handleAddQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { question: "", options: ["", "", "", ""], correctIndex: 0 },
      ],
    }));
  };

  const handleRemoveQuestion = (index) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...form.questions];
    newQuestions[index][field] = value;
    setForm((prev) => ({ ...prev, questions: newQuestions }));
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQuestions = [...form.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setForm((prev) => ({ ...prev, questions: newQuestions }));
  };

  const handleCreateSubmit = async () => {
    setFormError("");
    if (!form.title || !form.description) {
      setFormError("Title and description are required.");
      return;
    }
    if (form.questions.some((q) => !q.question || q.options.some((o) => !o))) {
      setFormError("All questions and options must be filled.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/quizzes", form);
      setShowCreateForm(false);
      setForm({
        title: "",
        description: "",
        questions: [{ question: "", options: ["", "", "", ""], correctIndex: 0 }],
        passingScore: 70,
        maxAttempts: 1,
      });
      loadQuizzes();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to create quiz.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Quizzes">
      <div className="instructor-header">
        <div>
          <h2>Quiz Management</h2>
          <p>Create and manage quizzes for your courses</p>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => setShowCreateForm(true)}
        >
          + Create Quiz
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading quizzes...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <h3>No quizzes yet</h3>
          <p>Create your first quiz to get started.</p>
        </div>
      ) : (
        <div className="quizzes-list">
          {quizzes.map((quiz) => {
            const totalSubmissions = quiz.submissions?.length || 0;
            const passedCount = quiz.submissions?.filter((s) => s.passed).length || 0;

            return (
              <div key={quiz._id} className="quiz-item">
                <div className="quiz-item__header">
                  <h3>{quiz.title}</h3>
                  <div className="quiz-stats">
                    <span className="stat-badge">{quiz.questions?.length || 0} Questions</span>
                    <span className="stat-badge">{totalSubmissions} Submissions</span>
                  </div>
                </div>

                <p className="quiz-item__description">{quiz.description}</p>

                <div className="quiz-item__meta">
                  <div className="meta-item">
                    <span className="meta-label">Passing Score:</span>
                    <span className="meta-value">{quiz.passingScore}%</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Max Attempts:</span>
                    <span className="meta-value">{quiz.maxAttempts === 1 ? "No Retakes" : quiz.maxAttempts}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Pass Rate:</span>
                    <span className="meta-value">
                      {totalSubmissions === 0 ? "—" : Math.round((passedCount / totalSubmissions) * 100) + "%"}
                    </span>
                  </div>
                </div>

                <div className="quiz-item__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setViewingSubmissions(quiz)}
                  >
                    View Submissions ({totalSubmissions})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Quiz Modal */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="create-quiz-title"
            style={{ maxWidth: "700px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h3 id="create-quiz-title">Create New Quiz</h3>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="quiz-title">Quiz Title *</label>
                <input
                  id="quiz-title"
                  type="text"
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 3 Knowledge Check"
                />
              </div>

              <div className="form-field">
                <label htmlFor="quiz-description">Description *</label>
                <textarea
                  id="quiz-description"
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what this quiz covers..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="passing-score">Passing Score (%)</label>
                  <input
                    id="passing-score"
                    type="number"
                    className="form-input"
                    value={form.passingScore}
                    onChange={(e) => setForm({ ...form, passingScore: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="max-attempts">Max Attempts</label>
                  <select
                    id="max-attempts"
                    className="form-input"
                    value={form.maxAttempts}
                    onChange={(e) => setForm({ ...form, maxAttempts: parseInt(e.target.value) })}
                  >
                    <option value={1}>No Retakes (1 attempt)</option>
                    <option value={2}>2 Attempts</option>
                    <option value={3}>3 Attempts</option>
                    <option value={999}>Unlimited</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <h4 style={{ marginBottom: "16px" }}>Questions *</h4>

                {form.questions.map((question, qIndex) => (
                  <div key={qIndex} className="quiz-question-editor" style={{ marginBottom: "20px", padding: "16px", backgroundColor: "var(--bg-elevated)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h5>Question {qIndex + 1}</h5>
                      {form.questions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => handleRemoveQuestion(qIndex)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="form-field">
                      <input
                        type="text"
                        className="form-input"
                        value={question.question}
                        onChange={(e) => handleQuestionChange(qIndex, "question", e.target.value)}
                        placeholder="Enter the question..."
                      />
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>Options:</label>
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={question.correctIndex === oIndex}
                            onChange={() => handleQuestionChange(qIndex, "correctIndex", oIndex)}
                            style={{ cursor: "pointer" }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            placeholder={`Option ${oIndex + 1}`}
                            style={{ flex: 1 }}
                          />
                          {question.correctIndex === oIndex && (
                            <span style={{ fontSize: "12px", color: "var(--green-600)", fontWeight: 500 }}>✓ Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={handleAddQuestion}
                  style={{ width: "100%" }}
                >
                  + Add Question
                </button>
              </div>

              {formError && <div className="form-error" style={{ marginTop: "16px" }}>{formError}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleCreateSubmit}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Quiz"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Submissions Modal */}
      {viewingSubmissions && (
        <div className="modal-overlay" onClick={() => setViewingSubmissions(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="submissions-title"
            style={{ maxWidth: "800px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h3 id="submissions-title">Submissions: {viewingSubmissions.title}</h3>
            </div>

            <div className="modal-body">
              {viewingSubmissions.submissions?.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0" }}>
                  No submissions yet
                </p>
              ) : (
                <table className="submissions-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Submitted</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingSubmissions.submissions?.map((submission) => (
                      <tr key={submission._id}>
                        <td>
                          <strong>{submission.studentName}</strong>
                          <br />
                          <small style={{ color: "var(--text-muted)" }}>{submission.studentEmail}</small>
                        </td>
                        <td>{new Date(submission.submittedAt).toLocaleDateString()}</td>
                        <td>
                          <strong>{submission.score}%</strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${submission.passed ? "status-badge--passed" : "status-badge--failed"}`}
                          >
                            {submission.passed ? "✓ Passed" : "✗ Failed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setViewingSubmissions(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default InstructorQuizzes;