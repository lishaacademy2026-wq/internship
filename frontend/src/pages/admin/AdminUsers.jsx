import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/client";

const EMPTY_FORM = { fullName: "", email: "", username: "", password: "", role: "student" };

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showCreate, setShowCreate] = useState(null); // null | "create" | user-object (edit)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [suspending, setSuspending] = useState(null);

  const load = () => {
    api
      .get("/admin/users", { params: { role, search } })
      .then(({ data }) => setUsers(data.users))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [role, search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
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
    setShowCreate(u);
  };

  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.fullName || !form.email || !form.username) {
      setFormError("Full name, email and username are required.");
      return;
    }
    if (showCreate === "create" && !form.password) {
      setFormError("Password is required when creating a user.");
      return;
    }
    setSaving(true);
    try {
      if (showCreate === "create") {
        await api.post("/admin/users", form);
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.patch(`/admin/users/${showCreate._id}`, payload);
      }
      setShowCreate(null);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/admin/users/${deletingId}`);
      setDeletingId(null);
      load();
    } catch (err) {
      alert("Failed to delete user.");
    }
  };

  const toggleSuspend = async (userId, currentStatus) => {
    setSuspending(userId);
    try {
      await api.patch(`/admin/users/${userId}/suspend`);
      load();
    } catch (err) {
      alert("Failed to update suspension status.");
    } finally {
      setSuspending(null);
    }
  };

  const isEditing = showCreate && showCreate !== "create";

  return (
    <DashboardLayout title="User Management">
      <div className="admin-header">
        <div className="admin-header__content">
          <h2>User Management</h2>
          <p>Manage all users, roles, and account status</p>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={openCreate}>
          + Add New User
        </button>
      </div>

      <div className="admin-filters">
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

      {/* Create / Edit User Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(null)} role="presentation">
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="user-modal-title"
            style={{ maxWidth: "500px", width: "100%" }}
          >
            <div className="modal-header">
              <h3 id="user-modal-title" style={{ marginBottom: "4px" }}>
                {isEditing ? "Edit User" : "Add New User"}
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                {isEditing
                  ? "Update user details. Leave password blank to keep current."
                  : "Create a new user account. A welcome email will be sent automatically."}
              </p>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label htmlFor="fullName">Full Name *</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  className="form-input"
                  value={form.fullName}
                  onChange={handleFormChange}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="form-field">
                <label htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className="form-input"
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="jane@example.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="username">Username *</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  className="form-input"
                  value={form.username}
                  onChange={handleFormChange}
                  placeholder="janedoe"
                />
              </div>

              <div className="form-field">
                <label htmlFor="password">{isEditing ? "New Password (optional)" : "Password *"}</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  className="form-input"
                  value={form.password}
                  onChange={handleFormChange}
                  placeholder={isEditing ? "Leave blank to keep current" : "Min 6 characters"}
                />
              </div>

              <div className="form-field">
                <label htmlFor="role">Role *</label>
                <select name="role" id="role" className="form-input" value={form.role} onChange={handleFormChange}>
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
            style={{ maxWidth: "400px" }}
          >
            <div className="modal-header">
              <h3 id="delete-title">Delete User?</h3>
              <p style={{ color: "var(--text-secondary)" }}>This action cannot be undone.</p>
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