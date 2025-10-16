import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Profile.css";
import dummy from "../assets/dummy.jpg";

export default function ViewUserProfile() {
  const { id } = useParams(); // Neo4j internal ID
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading"); // none | outgoing | connected
  const [loading, setLoading] = useState(true);

  // ✅ Fetch user and posts
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, postsRes] = await Promise.all([
          fetch(`http://localhost:3000/users/id/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://localhost:3000/user/${id}/posts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const userData = await userRes.json();
        const postsData = await postsRes.json();

        if (userRes.ok) setUser(userData.user);
        if (postsRes.ok) setPosts(postsData.posts || []);
      } catch (err) {
        console.error("Error fetching user/profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id && token) fetchAll();
  }, [id, token]);

  // ✅ Fetch connection status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`http://localhost:3000/connections/status/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setStatus(data.status || "none");
      else setStatus("none");
    } catch (err) {
      console.error("Status fetch error:", err);
      setStatus("none");
    }
  };

  useEffect(() => {
    if (id && token) fetchStatus();
  }, [id, token]);

  // ✅ Actions (Connect / Withdraw)
  const sendRequest = async () => {
    try {
      const res = await fetch("http://localhost:3000/connections/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId: Number(id) }),
      });
      const data = await res.json();
      alert(data.message);
      setTimeout(fetchStatus, 200);
    } catch (err) {
      console.error(err);
      alert("Error sending request");
    }
  };

  const withdraw = async () => {
    try {
      const res = await fetch("http://localhost:3000/connections/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId: Number(id) }),
      });
      const data = await res.json();
      alert(data.message);
      setTimeout(fetchStatus, 200);
    } catch (err) {
      console.error(err);
      alert("Error withdrawing request");
    }
  };

  // ✅ Start or open chat
  const handleChat = async () => {
    try {
      const res = await fetch("http://localhost:3000/chat/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId: Number(id) }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("openRoom", data.roomId);
        navigate("/chat");
      } else {
        alert(data.message || "Unable to open chat");
      }
    } catch (err) {
      console.error("Error starting chat:", err);
      alert("Server error while creating chat");
    }
  };

  if (loading) return <p className="loading">Loading profile...</p>;
  if (!user)
    return (
      <div className="not-found">
        <p>User not found or unavailable.</p>
        <button onClick={() => navigate(-1)} className="secondary-btn">
          ← Back
        </button>
      </div>
    );

  return (
    <div className="profile-page-wrapper">
      {/* --- Profile Header --- */}
      <div className="profile-header-card">
        <img src={dummy} alt={user.name} className="profile-image" />
        <div className="profile-header-info">
          <div className="user-basic">
            <h2>{user.name}</h2>
            <span className="user-role">{user.role}</span>
          </div>
          <p className="muted">{user.location || "No location specified"}</p>
          <p>{user.currentRole || "No current role added"}</p>
          <p className="about">{user.about || "No about info provided"}</p>

          {/* --- Connection Buttons --- */}
          <div className="button-row">
            {status === "loading" && (
              <button disabled className="secondary-btn">
                Checking...
              </button>
            )}

            {status === "none" && (
              <button onClick={sendRequest} className="primary-btn">
                Connect
              </button>
            )}

            {status === "outgoing" && (
              <>
                <button disabled className="secondary-btn">
                  Request Sent
                </button>
                <button onClick={withdraw} className="danger-btn">
                  Withdraw
                </button>
              </>
            )}

            {status === "connected" && (
              <>
                <span className="connected-tag">
                  <i className="fa-solid fa-link"></i> Connected
                </span>
                <button onClick={handleChat} className="chat-btn">
                  💬 Chat
                </button>
              </>
            )}

            <button onClick={() => navigate(-1)} className="secondary-btn">
              ← Back
            </button>
          </div>
        </div>
      </div>

      <div className="profile-divider"></div>

      {/* --- Posts Section --- */}
      <div className="posts-section">
        <h2>{user.name.split(" ")[0]}'s Posts</h2>
        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts yet.</p>
          </div>
        ) : (
          <div className="posts-grid">
            {posts.map((post) => (
              <div className="post-card" key={post.id}>
                <div className="post-header">
                  <h3>{post.title}</h3>
                  <span className={`badge ${post.category}`}>
                    {post.category}
                  </span>
                </div>
                <p className="post-desc">{post.description}</p>
                {post.price && <p className="price">₹{post.price}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
