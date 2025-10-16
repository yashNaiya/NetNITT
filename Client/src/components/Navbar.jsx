import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const controllerRef = useRef(null); // for aborting old API calls

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // 🔍 Fetch users live as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        // Abort old request if still running
        if (controllerRef.current) controllerRef.current.abort();

        controllerRef.current = new AbortController();
        const res = await fetch(
          `http://localhost:3000/users/search?q=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controllerRef.current.signal,
          }
        );

        if (!res.ok) return;
        const data = await res.json();
        setResults(data.users.slice(0, 5)); // ✅ Only top 5 results
        setShowDropdown(true);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Search error:", err);
      }
    };

    const delay = setTimeout(fetchResults, 250); // ⏱ small debounce
    return () => clearTimeout(delay);
  }, [query, token]);

  return (
    <nav className="navbar">
      <div className="nav-left" onClick={() => navigate("/feed")}>
        <h2 className="brand">NetNITT</h2>
      </div>

      {/* 🔍 Search box */}
      <div className="nav-center" ref={searchRef}>
        <input
          type="text"
          className="nav-search-input"
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
        />

        {showDropdown && results.length > 0 && (
          <div className="search-dropdown">
            {results.map((u) => (
              <div
                key={u.email}
                className="search-row"
                onClick={() => {
                  // console.log(u);
                  setShowDropdown(false);
                  setQuery("");
                  navigate(`/user/${u.id}`);
                }}
              >
                <img
                  src={u.image || "https://via.placeholder.com/60"}
                  alt={u.name}
                  className="search-avatar"
                />
                <div className="search-user-info">
                  <h4>{u.name}</h4>
                  <p className="search-role">{u.role}</p>
                  <p className="search-location">{u.location || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="nav-right">
        <button onClick={() => navigate("/feed")}>Feed</button>
        <button onClick={() => navigate("/profile")}>Profile</button>
        <button onClick={() => navigate("/chat")}>Chat</button>
        <button
          onClick={() => {
            localStorage.clear();
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
