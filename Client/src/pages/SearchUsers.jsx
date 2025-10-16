import { useState } from "react";

export default function SearchUsers() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const token = localStorage.getItem("token");

  const handleSearch = async () => {
    const res = await fetch(`http://localhost:3000/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setResults(data.users);
  };

  const sendRequest = async (targetEmail) => {
    await fetch("http://localhost:3000/connections/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetEmail }),
    });
    alert("Request sent!");
  };

  return (
    <div className="search-page">
      <h2>Find People</h2>
      <div className="search-bar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or role..."
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      <div className="search-results">
        {results.map((u) => (
          <div key={u.email} className="user-card">
            <img src={u.image || "https://via.placeholder.com/80"} alt="" />
            <div>
              <h4>{u.name}</h4>
              <p>{u.role}</p>
              <button onClick={() => sendRequest(u.email)}>Connect</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
