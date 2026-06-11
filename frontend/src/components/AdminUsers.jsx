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
    await api.delete(`/admin/users/${deletingId}`);
    setDeletingId(null);
    load();
  };

  const isEditing = showCreate && showCreate !== "create";

  return (
    <DashboardLayout title="User Management">
      <div className="catalog-toolbar">
        <input
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
          <option value="admin">Admins</option>
        </select>
        <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
          + Add User
        </button>
      </div>

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => openEdit(u)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    style={{ color: "var(--error, #b42318)", borderColor: "var(--error, #b42318)" }}
                    onClick={() => setDeletingId(u._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px 0" }}>
                  No users found.
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
            style={{ maxWidth: "480px", width: "100%" }}
          >
            <h3 id="user-modal-title">{isEditing ? "Edit User" : "Add New User"}</h3>
            <p style={{ marginTop: "4px", marginBottom: "20px", color: "var(--text-secondary)", fontSize: "14px" }}>
              {isEditing
                ? "Update the user details below. Leave password blank to keep existing."
                : "Fill in the details to create a new account. A welcome email will be sent automatically."}
            </p>

            <div className="settings-form__group" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", fontWeight: 500 }}>
                Full Name *
                <input
                  type="text"
                  name="fullName"
                  className="input"
                  value={form.fullName}
                  onChange={handleFormChange}
                  placeholder="e.g. Jane Doe"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", fontWeight: 500 }}>
                Email *
                <input
                  type="email"
                  name="email"
                  className="input"
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="jane@example.com"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", fontWeight: 500 }}>
                Username *
                <input
                  type="text"
                  name="username"
                  className="input"
                  value={form.username}
                  onChange={handleFormChange}
                  placeholder="janedoe"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", fontWeight: 500 }}>
                {isEditing ? "New Password (optional)" : "Password *"}
                <input
                  type="password"
                  name="password"
                  className="input"
                  value={form.password}
                  onChange={handleFormChange}
                  placeholder={isEditing ? "Leave blank to keep current" : "Min 6 characters"}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px", fontWeight: 500 }}>
                Role *
                <select name="role" className="input" value={form.role} onChange={handleFormChange}>
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>

            {formError && (
              <p style={{ color: "var(--error, #b42318)", fontSize: "13px", marginTop: "12px" }}>{formError}</p>
            )}

            <div className="settings-form__actions" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : isEditing ? "Save Changes" : "Create User"}
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
          >
            <h3 id="delete-title">Delete User</h3>
            <p style={{ marginTop: "8px" }}>
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="settings-form__actions" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn btn--primary"
                style={{ backgroundColor: "var(--error, #b42318)" }}
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
