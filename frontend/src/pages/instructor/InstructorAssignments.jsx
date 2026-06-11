import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";
import Toast from "../../components/Toast";

const InstructorAssignments = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    deadline: "", 
    maxScore: 100, 
    allowResubmit: true 
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewingSubmissions, setViewingSubmissions] = useState(null);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeForm, setGradeForm] = useState({ score: 0, feedback: "" });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadAssignments();
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      const { data } = await api.get("/courses/my");
      setCourses(data.courses || []);
      if (data.courses?.length > 0) {
        setSelectedCourse(data.courses[0]._id);
      }
    } catch (err) {
      console.error("Failed to load courses", err);
      setToast({ type: "error", message: "Failed to load your courses" });
    }
  };

  const loadAssignments = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/assignments/course/${selectedCourse}`);
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error("Failed to load assignments", err);
      setToast({ type: "error", message: "Failed to load assignments" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async () => {
    setFormError("");
    if (!form.title || !form.description || !form.deadline) {
      setFormError("Title, description, and deadline are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/assignments", {
        ...form,
        courseId: selectedCourse,
      });
      setShowCreateForm(false);
      setForm({ title: "", description: "", deadline: "", maxScore: 100, allowResubmit: true });
      setToast({ type: "success", message: "Assignment created successfully" });
      loadAssignments();
    } catch (err) {
      const errorMsg = err?.response?.data?.message || "Failed to create assignment.";
      setFormError(errorMsg);
      setToast({ type: "error", message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleGradeSubmit = async () => {
    setSaving(true);
    try {
      const submissionId = gradingSubmission._id;
      await api.patch(`/assignments/${viewingSubmissions._id}/submissions/${submissionId}/grade`, {
        score: parseInt(gradeForm.score),
        feedback: gradeForm.feedback,
      });
      setGradingSubmission(null);
      setGradeForm({ score: 0, feedback: "" });
      setToast({ type: "success", message: "Grade saved successfully" });
      loadAssignments();
    } catch (err) {
      const errorMsg = err?.response?.data?.message || "Failed to save grade.";
      setToast({ type: "error", message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const currentCourse = courses.find(c => c._id === selectedCourse);

  return (
    <DashboardLayout title="Assignments">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="instructor-page-container">
        <div className="instructor-header">
          <div className="instructor-header__content">
            <h2>Assignment Management</h2>
            <p>Create and grade assignments for your courses</p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => setShowCreateForm(true)}
          >
            + Create Assignment
          </button>
        </div>

        {/* Course Selector */}
        <div style={{ marginBottom: "32px" }}>
          <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "14px" }}>
            Select Course
          </label>
          <select
            value={selectedCourse || ""}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="form-input"
            style={{ maxWidth: "400px" }}
          >
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">
            <h3>No assignments yet</h3>
            <p>Create your first assignment for "{currentCourse?.title}" to get started.</p>
          </div>
        ) : (
          <div className="assignments-list">
            {assignments.map((assignment) => {
              const totalSubmissions = assignment.submissions?.length || 0;
              const gradedSubmissions = assignment.submissions?.filter((s) => s.status === "graded").length || 0;
              const isLate = new Date() > new Date(assignment.deadline);

              return (
                <div key={assignment._id} className="assignment-item">
                  <div className="assignment-item__header">
                    <h3>{assignment.title}</h3>
                    <div className="assignment-stats">
                      {isLate && <span className="stat-badge stat-badge--late">Deadline Passed</span>}
                      <span className="stat-badge">
                        {gradedSubmissions}/{totalSubmissions} graded
                      </span>
                    </div>
                  </div>

                  <p className="assignment-item__description">{assignment.description}</p>

                  <div className="assignment-item__meta">
                    <div className="meta-item">
                      <span className="meta-label">Deadline:</span>
                      <span className="meta-value">{new Date(assignment.deadline).toLocaleString()}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Max Score:</span>
                      <span className="meta-value">{assignment.maxScore}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Submissions:</span>
                      <span className="meta-value">{totalSubmissions}</span>
                    </div>
                  </div>

                  <div className="assignment-item__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => setViewingSubmissions(assignment)}
                    >
                      View Submissions ({totalSubmissions})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Assignment Modal */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="create-assignment-title"
            style={{ maxWidth: "600px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="create-assignment-title">Create New Assignment</h3>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "var(--bg-elevated)", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 500 }}>
                  Course: <strong>{currentCourse?.title}</strong>
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="title" className="form-field__label">Assignment Title *</label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 3 Discussion"
                />
              </div>

              <div className="form-field">
                <label htmlFor="description" className="form-field__label">Description *</label>
                <textarea
                  id="description"
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Write clear instructions for the assignment..."
                  rows={5}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="deadline" className="form-field__label">Deadline *</label>
                  <input
                    id="deadline"
                    type="datetime-local"
                    className="form-input"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="maxScore" className="form-field__label">Max Score</label>
                  <input
                    id="maxScore"
                    type="number"
                    className="form-input"
                    value={form.maxScore}
                    onChange={(e) => setForm({ ...form, maxScore: parseInt(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>

              <label className="checkbox-label" style={{ marginBottom: "20px" }}>
                <input
                  type="checkbox"
                  checked={form.allowResubmit}
                  onChange={(e) => setForm({ ...form, allowResubmit: e.target.checked })}
                />
                Allow students to resubmit
              </label>

              {formError && <div className="form-error">{formError}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleCreateSubmit}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Assignment"}
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
            style={{ maxWidth: "900px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}
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
                      <th>Student Name</th>
                      <th>Email</th>
                      <th>Submitted At</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingSubmissions.submissions?.map((submission) => {
                      const isLateSubmission = new Date(submission.submittedAt) > new Date(viewingSubmissions.deadline);
                      return (
                        <tr key={submission._id}>
                          <td>
                            <strong>{submission.studentName}</strong>
                          </td>
                          <td>{submission.studentEmail}</td>
                          <td>
                            <div>
                              <div>{new Date(submission.submittedAt).toLocaleDateString()}</div>
                              <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                                {new Date(submission.submittedAt).toLocaleTimeString()}
                              </small>
                              {isLateSubmission && (
                                <div style={{ color: "#d32f2f", fontSize: "11px", fontWeight: 500, marginTop: "4px" }}>
                                  ⚠️ Late Submission
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${submission.status === "graded" ? "status-badge--graded" : "status-badge--pending"}`}
                            >
                              {submission.status === "graded" ? "Graded" : "Pending"}
                            </span>
                          </td>
                          <td>
                            {submission.status === "graded" ? (
                              <strong>{submission.score}/{viewingSubmissions.maxScore}</strong>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              onClick={() => setGradingSubmission(submission)}
                            >
                              {submission.status === "graded" ? "Edit" : "Grade"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Grade Submission Modal */}
      {gradingSubmission && (
        <div className="modal-overlay" onClick={() => setGradingSubmission(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="grade-title"
            style={{ maxWidth: "520px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="grade-title">Grade Submission</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, marginTop: "4px" }}>
                <strong>{gradingSubmission.studentName}</strong> • {gradingSubmission.studentEmail}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0 0" }}>
                Submitted: {new Date(gradingSubmission.submittedAt).toLocaleString()}
              </p>
            </div>

            <div className="modal-body">
              <div className="submission-content" style={{ marginBottom: "20px", padding: "14px", backgroundColor: "var(--bg-elevated)", borderRadius: "8px" }}>
                <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>Submission Content:</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>
                  {gradingSubmission.content}
                </p>
                {gradingSubmission.fileUrl && (
                  <a href={gradingSubmission.fileUrl} target="_blank" rel="noreferrer" className="link-green" style={{ display: "block", marginTop: "10px" }}>
                    📎 View Attached File
                  </a>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="score" className="form-field__label">Score (0 - {viewingSubmissions.maxScore})</label>
                <input
                  id="score"
                  type="number"
                  className="form-input"
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  min="0"
                  max={viewingSubmissions.maxScore}
                />
              </div>

              <div className="form-field">
                <label htmlFor="feedback" className="form-field__label">Feedback</label>
                <textarea
                  id="feedback"
                  className="form-textarea"
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  placeholder="Provide constructive feedback to the student..."
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleGradeSubmit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Grade"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setGradingSubmission(null)}
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

export default InstructorAssignments;