import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionForm, setSubmissionForm] = useState({ content: "", fileUrl: "" });
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/assignments/my");
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error("Failed to load assignments", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmissionError("");
    if (!submissionForm.content && !submissionForm.fileUrl) {
      setSubmissionError("Please provide content or upload a file.");
      return;
    }
    setSubmitting(selectedAssignment._id);
    try {
      await api.post(`/api/assignments/${selectedAssignment._id}/submit`, {
        content: submissionForm.content,
        fileUrl: submissionForm.fileUrl,
      });
      setSubmissionForm({ content: "", fileUrl: "" });
      setSelectedAssignment(null);
      loadAssignments();
    } catch (err) {
      setSubmissionError(err?.response?.data?.message || "Failed to submit assignment.");
    } finally {
      setSubmitting(null);
    }
  };

  const getSubmissionStatus = (assignment) => {
    const submission = assignment.submissions?.[0];
    if (!submission) return "not_submitted";
    return submission.status === "graded" ? "graded" : "pending";
  };

  const getSubmission = (assignment) => {
    return assignment.submissions?.[0] || null;
  };

  return (
    <DashboardLayout title="My Assignments">
      <div className="assignment-header">
        <div>
          <h2>My Assignments</h2>
          <p>Complete your course assignments and track your progress</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">
          <h3>No assignments yet</h3>
          <p>Check back soon for new assignments from your instructors.</p>
        </div>
      ) : (
        <div className="assignments-grid">
          {assignments.map((assignment) => {
            const status = getSubmissionStatus(assignment);
            const submission = getSubmission(assignment);
            return (
              <div key={assignment._id} className="assignment-card">
                <div className="assignment-card__header">
                  <h3>{assignment.title}</h3>
                  <span className={`assignment-status assignment-status--${status}`}>
                    {status === "graded" ? "✓ Graded" : status === "pending" ? "⏱ Pending Review" : "○ Not Submitted"}
                  </span>
                </div>

                <p className="assignment-card__description">{assignment.description}</p>

                <div className="assignment-card__details">
                  <div className="detail-item">
                    <span className="detail-label">Deadline:</span>
                    <span className="detail-value">{new Date(assignment.deadline).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Max Score:</span>
                    <span className="detail-value">{assignment.maxScore}</span>
                  </div>
                  {submission && (
                    <div className="detail-item">
                      <span className="detail-label">Submitted:</span>
                      <span className="detail-value">{new Date(submission.submittedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {submission?.status === "graded" && (
                  <div className="submission-feedback">
                    <div className="feedback-score">
                      <strong>{submission.score}/{assignment.maxScore}</strong>
                    </div>
                    <p className="feedback-text">{submission.feedback}</p>
                  </div>
                )}

                <div className="assignment-card__actions">
                  {status === "not_submitted" ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setSelectedAssignment(assignment)}
                    >
                      Submit Assignment
                    </button>
                  ) : status === "pending" ? (
                    <>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
                        ⏳ Waiting for instructor feedback...
                      </p>
                      {assignment.allowResubmit && (
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => setSelectedAssignment(assignment)}
                        >
                          Resubmit
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: "13px", color: "var(--text-success)", marginBottom: "12px" }}>
                        ✓ Graded
                      </p>
                      {assignment.allowResubmit && (
                        <button
                          type="button"
                          className="btn btn--outline"
                          onClick={() => setSelectedAssignment(assignment)}
                        >
                          Resubmit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="modal-overlay" onClick={() => setSelectedAssignment(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="submit-modal-title"
            style={{ maxWidth: "600px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="submit-modal-title">Submit Assignment: {selectedAssignment.title}</h3>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="content">Assignment Content</label>
                <textarea
                  id="content"
                  className="form-textarea"
                  value={submissionForm.content}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, content: e.target.value })}
                  placeholder="Write your assignment response here..."
                  rows={6}
                />
              </div>

              <div className="form-field">
                <label htmlFor="fileUrl">Attach File (Optional)</label>
                <input
                  id="fileUrl"
                  type="url"
                  className="form-input"
                  value={submissionForm.fileUrl}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, fileUrl: e.target.value })}
                  placeholder="https://example.com/file.pdf"
                />
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Paste the URL of your file (PDF, Word, etc.)
                </p>
              </div>

              {submissionError && <div className="form-error">{submissionError}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={submitting === selectedAssignment._id}
              >
                {submitting === selectedAssignment._id ? "Submitting..." : "Submit Assignment"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setSelectedAssignment(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentAssignments;