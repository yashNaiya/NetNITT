import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ NEW import
import "./Profile.css";
import dummy from "../assets/dummy.jpg";

function Profile() {
  const [user, setUser] = useState(null);
  // --- Connections Data ---
  const [connections, setConnections] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("connections"); // "connections" | "sent" | "received"

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    image: "",
    location: "",
    about: "",
    currentRole: "",
  });
  const [posts, setPosts] = useState([]);
  const [editingPost, setEditingPost] = useState(null);
  const token = localStorage.getItem("token");
  const navigate = useNavigate(); // ✅ NEW
  // --- Connection Requests ---
  const [requests, setRequests] = useState([]); // incoming requests
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchConnections = async () => {
    try {
      const res = await fetch("http://localhost:3000/connections/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const uniqueConnections = Array.from(
          new Map((data.connections || []).map(c => [c.id, c])).values()
        );
        setConnections(uniqueConnections);
      }
    } catch (err) {
      console.error("Error fetching connections:", err);
    }
  };


  const fetchSentRequests = async () => {
    try {
      const res = await fetch("http://localhost:3000/connections/sent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSentRequests(data.requests || []);
    } catch (err) {
      console.error("Error fetching sent requests:", err);
    }
  };

  const fetchReceivedRequests = async () => {
    try {
      const res = await fetch("http://localhost:3000/connections/received", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setReceivedRequests(data.requests || []);
    } catch (err) {
      console.error("Error fetching received requests:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConnections();
      fetchSentRequests();
      fetchReceivedRequests();
    }
  }, [token]);


  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch("http://localhost:3000/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setFormData({
          image: data.user.image || "",
          location: data.user.location || "",
          about: data.user.about || "",
          currentRole: data.user.currentRole || "",
        });
      }
    };
    fetchUser();
  }, [token]);

  // Fetch posts
  const fetchUserPosts = async () => {
    console.log("sending...")
    const res = await fetch("http://localhost:3000/user/posts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log(data)
    if (res.ok) setPosts(data.posts);
  };

  useEffect(() => {
    fetchUserPosts();
  }, [token]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    const res = await fetch("http://localhost:3000/user/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (res.ok) {
      alert("Profile updated successfully!");
      setUser(data.user);
      setEditMode(false);
    } else alert(data.message || "Error updating profile");
  };
  const respondToRequest = async (senderId, action) => {
    try {
      const res = await fetch("http://localhost:3000/connections/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senderId: Number(senderId), action }), // ✅ fixed body
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        // Refresh received & connections after responding
        fetchReceivedRequests();
        fetchConnections();
      } else {
        alert(data.message || "Unable to update request");
      }
    } catch (err) {
      console.error("Error responding to request:", err);
      alert("Failed to update request. Please try again.");
    }
  };



  const deletePost = async (id) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const res = await fetch(`http://localhost:3000/posts/delete/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchUserPosts();
  };

  const saveEditPost = async (e) => {
    e.preventDefault();
    const res = await fetch(
      `http://localhost:3000/posts/update/${editingPost.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingPost),
      }
    );
    if (res.ok) {
      setEditingPost(null);
      fetchUserPosts();
    }
  };

  if (!user) return <p className="loading">Loading...</p>;

  return (
    <div className="profile-page-wrapper">
      <div className="profile-header-card">
        <img
          src={dummy}
          alt="Profile"
          className="profile-image"
        />

        <div className="profile-header-info">
          {editMode ? (
            <div className="edit-form">
              <input
                type="text"
                name="image"
                placeholder="Profile Image URL"
                value={formData.image}
                onChange={handleChange}
              />
              <input
                type="text"
                name="location"
                placeholder="Location"
                value={formData.location}
                onChange={handleChange}
              />
              <textarea
                name="about"
                placeholder="About..."
                value={formData.about}
                onChange={handleChange}
              />
              <input
                type="text"
                name="currentRole"
                placeholder="Current Role"
                value={formData.currentRole}
                onChange={handleChange}
              />
              <div className="button-row">
                <button onClick={handleSave} className="primary-btn">
                  Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="secondary-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="user-basic">
                <h2>{user.name}</h2>
                <span className="user-role">{user.role}</span>
              </div>
              <p className="muted">{user.email}</p>
              <p>{user.location || "Add location"}</p>
              <p>{user.currentRole || "Add current role"}</p>
              <p className="about">{user.about || "Add about info"}</p>
              <button onClick={() => setEditMode(true)} className="primary-btn">
                Complete Profile
              </button>
            </>
          )}
        </div>
      </div>

      <div className="profile-divider"></div>

      {/* --- Connections Section --- */}
      <div className="connections-section">
        <h2>Your Network</h2>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={activeTab === "connections" ? "tab active" : "tab"}
            onClick={() => setActiveTab("connections")}
          >
            Connections ({connections.length})
          </button>
          <button
            className={activeTab === "sent" ? "tab active" : "tab"}
            onClick={() => setActiveTab("sent")}
          >
            Requests Sent ({sentRequests.length})
          </button>
          <button
            className={activeTab === "received" ? "tab active" : "tab"}
            onClick={() => setActiveTab("received")}
          >
            Requests Received ({receivedRequests.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "connections" && (
            <>
              {connections.length === 0 ? (
                <p className="muted">You have no connections yet.</p>
              ) : (
                <div className="connection-grid">
                  {connections.map((c) => (
                    <div
                      className="connection-card"
                      key={c.id}
                      onClick={() => navigate(`/user/${c.id}`)}
                    >
                      <img
                        src={c.image || "https://via.placeholder.com/80"}
                        alt={c.name}
                        className="connection-avatar"
                      />
                      <div>
                        <h4>{c.name}</h4>
                        <p>{c.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "sent" && (
            <>
              {sentRequests.length === 0 ? (
                <p className="muted">No requests sent.</p>
              ) : (
                sentRequests.map((r) => (
                  <div className="request-card" key={r.id}>
                    <div className="request-info">
                      <h4>{r.name}</h4>
                      <p>{r.role}</p>
                    </div>
                    <button
                      onClick={() => respondToRequest(r.id, "withdraw")}
                      className="danger-btn"
                    >
                      Withdraw
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "received" && (
            <>
              {receivedRequests.length === 0 ? (
                <p className="muted">No pending connection requests.</p>
              ) : (
                receivedRequests.map((r) => (
                  <div className="request-card" key={r.id}>
                    <div className="request-info">
                      <h4>{r.name}</h4>
                      <p>{r.role}</p>
                    </div>
                    <div className="request-actions">
                      <button
                        onClick={() => respondToRequest(r.id, "accept")}
                        className="primary-btn"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(r.id, "reject")}
                        className="danger-btn"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>


      <div className="posts-section">
        <h2>Your Posts</h2>

        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts yet — create something awesome!</p>
          </div>
        ) : (
          <div className="posts-grid">
            {posts.map((post) =>
              editingPost && editingPost.id === post.id ? (
                <form
                  key={post.id}
                  className="edit-post-form"
                  onSubmit={saveEditPost}
                >
                  <input
                    type="text"
                    value={editingPost.title}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, title: e.target.value })
                    }
                  />
                  <textarea
                    value={editingPost.description}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        description: e.target.value,
                      })
                    }
                  />
                  <div className="button-row">
                    <button type="submit" className="primary-btn">
                      Save
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setEditingPost(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  className="post-card"
                  key={post.id}
                  onClick={(e) => {
                    if (
                      e.target.classList.contains("edit") ||
                      e.target.classList.contains("delete") ||
                      e.target.tagName === "BUTTON"
                    )
                      return;
                    navigate(`/post/${post.id}`);
                  }}
                >
                  <div className="post-header">
                    <h3>{post.title || "Untitled Post"}</h3>
                    <div className="post-meta">
                      {post.direction && (
                        <span
                          className={`badge ${post.direction === "needed" ? "badge-need" : "badge-offer"}`}
                        >
                          {post.direction === "needed" ? "Needs" : "Offers"}
                        </span>

                      )}
                      {post.type && (
                        <span className="badge type-badge">
                          {post.type.replace("Post", "")}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="post-desc">
                    {post.description || "No description provided."}
                  </p>

                  {post.location && (
                    <p className="meta-item">
                      📍 <strong>{post.location}</strong>
                    </p>
                  )}

                  {post.company && (
                    <p className="meta-item">
                      🏢 <strong>{post.company}</strong>
                    </p>
                  )}

                  {post.price && (
                    <p className="price">₹{post.price}</p>
                  )}

                  {post.fee && (
                    <p className="meta-item">💰 Fee: {post.fee}</p>
                  )}

                  {post.subject && (
                    <p className="meta-item">📘 Subject: {post.subject}</p>
                  )}

                  {post.sport && (
                    <p className="meta-item">🏏 Sport: {post.sport}</p>
                  )}

                  <div className="post-actions">
                    <button
                      onClick={() => setEditingPost(post)}
                      className="small-btn edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="small-btn delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>


    </div>
  );
}

export default Profile;
