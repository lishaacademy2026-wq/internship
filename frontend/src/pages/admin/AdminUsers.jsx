import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";
import Toast from "../../components/Toast";

const generateUsername = (email) => {
  return email.split("@")[0].toLowerCase();
};

const generatePassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const EMPTY_FORM = { fullName: "", email: "", username: "", password: "", role: "student" };

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showCreate, setShowCreate] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [suspending, setSuspending] = useState(null);
  const [toast, setToast] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const load = () => {
    api
      .get("/admin/users", { params: { role, search } })
      .then(({ data }) => setUsers(data.users))
      .catch((err) => {
        setToast({ type: "error", message: "Failed to load users" });
      });
  };

  useEffect(() => {
    load();
  }, [role, search]);

  const validateForm = () => {
    const errors = {};
    
    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required";
    }
    
    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Please enter a valid email";
    }
    
    if (!form.username.trim()) {
      errors.username = "Username is required";
    } else if (form.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }
    
    if (showCreate === "create" && !form.password) {
      errors.password = "Password is required for new users";
    } else if (form.password && form.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setValidationErrors({});
    setShowCreate("create");
  };

  const openEdit = (u) => {
    setForm({
      fullName: u.fullName || "",
      email: u.email || "",
      username: u.username || "",
      password: "",
      role: u.role || "student",
    });
    setFormError("");
    setValidationErrors({});
    setShowCreate(u);
  };

  const handleEmailChange = (e) => {
    const email = e.target.value;
    setForm((prev) => ({
      ...prev,
      email,
      username: generateUsername(email),
      password: showCreate === "create" ? generatePassword() : prev.password,
    }));
  };

  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setFormError("");
    setSaving(true);
    try {
      if (showCreate === "create") {
        await api.post("/admin/users", form);
        setToast({ type: "success", message: "User created successfully! Welcome email sent." });
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.patch(`/admin/users/${showCreate._id}`, payload);
        setToast({ type: "success", message: "User updated successfully!" });
      }
      setShowCreate(null);
      load();
    } catch (err) {
      const errorMsg = err?.response?.data?.message || "Failed to save user.";
      setFormError(errorMsg);
      setToast({ type: "error", message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/admin/users/${deletingId}`);
      setDeletingId(null);
      setToast({ type: "success", message: "User deleted successfully" });
      load();
    } catch (err) {
      setToast({ type: "error", message: "Failed to delete user" });
    }
  };

  const toggleSuspend = async (userId, currentStatus) => {
    setSuspending(userId);
    try {
      await api.patch(`/admin/users/${userId}/suspend`);
      setToast({ type: "success", message: currentStatus ? "User unsuspended" : "User suspended" });
      load();
    } catch (err) {
      setToast({ type: "error", message: "Failed to update suspension status" });
    } finally {
      setSuspending(null);
    }
  };

  const isEditing = showCreate && showCreate !== "create";

  return (
    <DashboardLayout title="User Management">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="admin-page-container">
        <div className="admin-header">
          <div className="admin-header__content">
            <h2>User Management</h2>
            <p>Manage all users, roles, and account status</p>
          </div>
          <button type="button" className="btn btn--primary btn--lg" onClick={openCreate}>
            + Add New User
          </button>
        </div>

        <div className="admin-filters-container">
          <div className="admin-filters__search">
            <input
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input"
            />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="filter-select">
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        <div className="admin-users-table-wrapper">
          <div className="admin-users-table">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar" style={{ backgroundColor: u.role === "admin" ? "#d91e63" : u.role === "instructor" ? "#2196f3" : "#4caf50" }}>
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span>{u.fullName}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><code className="username-badge">{u.username}</code></td>
                    <td><span className={`role-badge role-badge--${u.role}`}>{u.role}</span></td>
                    <td>
                      <span className={`status-badge ${u.isSuspended ? "status-badge--suspended" : "status-badge--active"}`}>
                        {u.isSuspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => openEdit(u)}
                          title="Edit user"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => toggleSuspend(u._id, u.isSuspended)}
                          disabled={suspending === u._id}
                          title={u.isSuspended ? "Unsuspend user" : "Suspend user"}
                        >
                          {suspending === u._id ? "..." : u.isSuspended ? "Unsuspend" : "Suspend"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm btn--danger"
                          onClick={() => setDeletingId(u._id)}
                          title="Delete user"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "48px 0" }}>
                      <p style={{ fontSize: "16px", fontWeight: 500 }}>No users found</p>
                      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="user-modal-title"
            style={{ maxWidth: "520px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="user-modal-title" style={{ marginBottom: "8px" }}>
                {isEditing ? "Edit User" : "Add New User"}
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
                {isEditing
                  ? "Update user details. Leave password blank to keep current."
                  : "Create a new user account. A welcome email will be sent automatically."}
              </p>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="fullName" className="form-field__label">Full Name *</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  className={`form-input ${validationErrors.fullName ? "form-input--error" : ""}`}
                  value={form.fullName}
                  onChange={handleFormChange}
                  placeholder="e.g. Jane Doe"
                />
                {validationErrors.fullName && (
                  <span className="form-field__error">{validationErrors.fullName}</span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="email" className="form-field__label">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className={`form-input ${validationErrors.email ? "form-input--error" : ""}`}
                  value={form.email}
                  onChange={handleEmailChange}
                  placeholder="jane@example.com"
                />
                {validationErrors.email && (
                  <span className="form-field__error">{validationErrors.email}</span>
                )}
                <p className="form-field__hint">Username and password will be auto-generated</p>
              </div>

              <div className="form-field">
                <label htmlFor="username" className="form-field__label">Username *</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className={`form-input ${validationErrors.username ? "form-input--error" : ""}`}
                  value={form.username}
                  onChange={handleFormChange}
                  placeholder="Auto-generated from email"
                  readOnly
                />
                {validationErrors.username && (
                  <span className="form-field__error">{validationErrors.username}</span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="password" className="form-field__label">{isEditing ? "New Password (optional)" : "Password *"}</label>
                <input
                  id="password"
                  type="text"
                  name="password"
                  className={`form-input ${validationErrors.password ? "form-input--error" : ""}`}
                  value={form.password}
                  onChange={handleFormChange}
                  placeholder="Auto-generated"
                  readOnly
                />
                {validationErrors.password && (
                  <span className="form-field__error">{validationErrors.password}</span>
                )}
                <p className="form-field__hint">Unique password auto-generated for security</p>
              </div>

              <div className="form-field">
                <label htmlFor="role" className="form-field__label">Role *</label>
                <select 
                  name="role" 
                  id="role" 
                  className="form-input" 
                  value={form.role} 
                  onChange={handleFormChange}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {formError && <div className="form-error">{formError}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : isEditing ? "Save Changes" : "Create User"}
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowCreate(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="delete-title"
            style={{ maxWidth: "420px" }}
          >
            <div className="modal-header">
              <h3 id="delete-title">Delete User?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>This action cannot be undone.</p>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                Are you sure you want to delete this user? All associated data will be permanently removed.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn--primary btn--danger"
                onClick={confirmDelete}
              >
                Delete User
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setDeletingId(null)}
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

export default AdminUsers;