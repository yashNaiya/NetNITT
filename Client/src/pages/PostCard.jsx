import { useState } from "react";
import "./PostCard.css";

function PostCard({ post, onInterest }) {
  const {
    id,
    title,
    description,
    price,
    location,
    company,
    subject,
    fee,
    sport,
    postedBy,
    role,
    createdAt,
  } = post;

  const [loading, setLoading] = useState(false);
  const [interested, setInterested] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const token = localStorage.getItem("token");

  const displayMeta = () => {
    if (company) return company;
    if (location) return location;
    if (subject) return subject;
    if (sport) return sport;
    return "";
  };

  const handleInterestClick = async () => {
    if (loading || interested) return;
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/interest/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: id,
          message: `Interested in your post "${title}"`,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setInterested(true);
        // 🧠 Add smooth fade-out before removing
        setFadeOut(true);
        setTimeout(() => {
          if (onInterest) onInterest(id);
        }, 400); // wait for fade animation to finish
      } else {
        alert(data.message || "Error showing interest");
      }
    } catch (err) {
      console.error("❌ Error creating interest:", err);
      alert("Failed to record interest. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`post-card ${fadeOut ? "fade-out" : ""}`}>
      <div className="post-header">
        <h3 className="post-title">{title}</h3>
        <span className="post-role">{role}</span>
      </div>

      <div className="post-body">
        <p className="post-desc">{description}</p>

        <div className="post-meta">
          {displayMeta() && (
            <p>
              <strong>Details:</strong> {displayMeta()}
            </p>
          )}
          {price && (
            <p>
              <strong>Price:</strong> ₹{price}
            </p>
          )}
          {fee && (
            <p>
              <strong>Fee:</strong> ₹{fee}
            </p>
          )}
          {createdAt && (
            <p className="muted">
              <small>
                Posted on {new Date(createdAt).toLocaleDateString("en-IN")}
              </small>
            </p>
          )}
        </div>
      </div>

      <div className="post-footer">
        <div className="post-user">
          <div className="user-avatar">
            {postedBy ? postedBy[0].toUpperCase() : "U"}
          </div>
          <div>
            <p className="user-name">{postedBy}</p>
          </div>
        </div>

        <button
          className={`interest-btn ${interested ? "interested" : ""}`}
          onClick={handleInterestClick}
          disabled={loading || interested}
        >
          {loading
            ? "Submitting..."
            : interested
            ? "Interested ✔"
            : "Show Interest"}
        </button>
      </div>
    </div>
  );
}

export default PostCard;
