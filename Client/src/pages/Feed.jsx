import { useEffect, useState } from "react";
import "./Feed.css";
import PostCard from "./PostCard";
import PostForm from "./PostForm";

function Feed() {
  const [posts, setPosts] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");
  const [activeService, setActiveService] = useState("mentorship");
  const [direction, setDirection] = useState("offered");
  const token = localStorage.getItem("token");

  // ✅ Fetch posts for the selected service
  const fetchPosts = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/post/${activeService}?direction=${direction}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        const sorted = data.posts.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setPosts(sorted);
        setFilteredPosts(sorted);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  // ✅ Fetch recommendations relevant to the active service
  const fetchRecommended = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/feed/recommended?service=${activeService}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      console.log(data)
      if (res.ok) setRecommended(data.posts);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  };

  // 🔁 Re-fetch when switching services or direction
  useEffect(() => {
    if (token) {
      fetchPosts();
      fetchRecommended();
    }
  }, [activeService, direction]);

  // 🔄 Sort posts
  useEffect(() => {
    let sorted = [...posts];
    sorted.sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt)
    );
    setFilteredPosts(sorted);
  }, [sortOrder, posts]);

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <h2 className="sidebar-logo">LinkNITT</h2>
        <nav className="sidebar-nav">
          {[
            ["market", "Marketplace"],
            ["food", "Food Services"],
            ["tutoring", "Tutoring"],
            ["mentorship", "Mentorship"],
            ["parttime", "Campus Jobs"],
            ["fulltime", "Full-Time Jobs"],
            ["sports", "Sports"],
            ["general", "General"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`sidebar-btn ${
                activeService === key ? "active" : ""
              }`}
              onClick={() => setActiveService(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="new-post-btn" onClick={() => setShowForm(true)}>
            + New Post
          </button>
        </div>
      </aside>

      {/* Main Section */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-info">
            <h1>{activeService.toUpperCase()}</h1>
            <p className="muted">
              {direction === "needed"
                ? "Viewing requests for this category"
                : "Viewing available offers"}
            </p>
          </div>

          <div className="header-controls">
            <div className="direction-toggle">
              <button
                className={direction === "needed" ? "active" : ""}
                onClick={() => setDirection("needed")}
              >
                I Need
              </button>
              <button
                className={direction === "offered" ? "active" : ""}
                onClick={() => setDirection("offered")}
              >
                I Offer
              </button>
            </div>
          </div>
        </header>

        {/* Recommended Section */}
        <section className="recommended-section">
          <h2>Recommended For You</h2>
          {recommended.length === 0 ? (
            <p className="muted">No recommendations yet.</p>
          ) : (
            <div className="grid fade-in">
              {recommended.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>

        {/* Posts Section */}
        <section className="posts-section">
          <h2>
            {direction === "needed"
              ? `Requests in ${activeService}`
              : `Offers in ${activeService}`}
          </h2>
          {filteredPosts.length === 0 ? (
            <div className="empty-state">
              <p>No posts found.</p>
            </div>
          ) : (
            <div className="grid fade-in">
              {filteredPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal */}
      {showForm && (
        <div className="overlay">
          <div className="modal">
            <PostForm
              activeService={activeService}
              direction={direction}
              onPosted={() => {
                fetchPosts();
                setShowForm(false);
              }}
            />
            <button
              className="close-modal"
              onClick={() => setShowForm(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Feed;
