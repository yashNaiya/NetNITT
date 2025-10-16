import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./PostDetails.css";

export default function PostDetails() {
  const { id } = useParams();
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [interests, setInterests] = useState([]);
  const [selected, setSelected] = useState([]);

  // Fetch single post details
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch("http://localhost:3000/post/details", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id }),
        });

        const data = await res.json();
        if (res.ok) {
          setPost(data.post);
          setInterests(data.interests || []);
        } else if (res.status === 404) {
          alert("Post not found or deleted.");
          navigate("/profile");
        } else {
          console.error("Server error:", data);
        }
      } catch (err) {
        console.error("Error fetching post:", err);
      }
    };

    fetchPost();
  }, [id, token, navigate]);

  const handleAccept = async (userEmail) => {
  try {
    // Optional: visual feedback (disable button, etc.)
    console.log(`Accepting interest from ${userEmail}...`);

    const res = await fetch("http://localhost:3000/interest/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ postId: id, userEmail }),
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ 1. Remove that user from interests immediately
      setInterests((prev) => prev.filter((i) => i.userEmail !== userEmail));

      // ✅ 2. Optional toast or inline feedback
      alert(`Accepted ${userEmail} — chat created successfully!`);

      // ✅ 3. Store room info for chat
      if (data.roomId) {
        localStorage.setItem("openRoom", data.roomId);
      }

      // ✅ 4. Redirect to chat after slight delay for smooth UX
      setTimeout(() => navigate("/chat"), 400);
    } else {
      alert(data.message || "Failed to accept interest");
    }
  } catch (err) {
    console.error("Error accepting interest:", err);
    alert("Server error while accepting interest.");
  }
};


  const handleReject = async (userEmail) => {
    try {
      const res = await fetch("http://localhost:3000/interest/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: id, userEmail }),
      });
      if (res.ok) {
        setInterests((prev) =>
          prev.filter((i) => i.userEmail !== userEmail)
        );
      }
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  if (!post)
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading post details...</p>
      </div>
    );

  return (
    <div className="postdetails-page">
      {/* --- Header Section --- */}
      <div className="postdetails-card">
        <div className="postdetails-header">
          <h2>{post.title}</h2>
          <div className="meta-line">
            {post.direction && (
              <span
                className={`badge ${
                  post.direction === "needed" ? "badge-need" : "badge-offer"
                }`}
              >
                {post.direction === "needed" ? "Needs" : "Offers"}
              </span>
            )}
            {post.type && (
              <span className="badge badge-type">
                {post.type.replace("Post", "")}
              </span>
            )}
            <span className="muted">
              {new Date(post.createdAt).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <p className="description">{post.description}</p>

        <div className="postdetails-info">
          {post.location && <p>📍 {post.location}</p>}
          {post.company && <p>🏢 {post.company}</p>}
          {post.subject && <p>📘 {post.subject}</p>}
          {post.sport && <p>🏏 {post.sport}</p>}
          {post.price && <p>💰 ₹{post.price}</p>}
          {post.fee && <p>💸 Fee: ₹{post.fee}</p>}
          {post.extra && <p>📝 {post.extra}</p>}
        </div>

        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to Profile
        </button>
      </div>

      {/* --- Interested Users Section --- */}
      <div className="postdetails-card">
        <h3>Interested Users</h3>

        {interests.length === 0 ? (
          <p className="empty">No one has shown interest yet.</p>
        ) : (
          <div className="interest-list">
            {interests.map((i) => (
              <div className="interest-item" key={i.userEmail}>
                <div className="interest-info">
                  <div className="avatar-circle">
                    {i.userName?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h4>{i.userName}</h4>
                    <p className="muted">{i.userEmail}</p>
                  </div>
                </div>

                <div className="interest-actions">
                  <button
                    className="btn-accept"
                    onClick={() => handleAccept(i.userEmail)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => handleReject(i.userEmail)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
