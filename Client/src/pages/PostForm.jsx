import { useState } from "react";

function PostForm({ activeService, direction, onPosted }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    company: "",
    subject: "",
    fee: "",
    sport: "",
  });

  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("token");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      type: activeService,
      direction, // needed/offered
    };

    try {
      const res = await fetch("http://localhost:3000/post/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert(
          `${direction === "needed" ? "Need" : "Offer"} ${activeService} post created successfully!`
        );
        setForm({
          title: "",
          description: "",
          price: "",
          location: "",
          company: "",
          subject: "",
          fee: "",
          sport: "",
        });
        onPosted?.();
      } else {
        alert(data.message || "Error creating post");
      }
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic fields for post type
  const renderExtraFields = () => {
    switch (activeService) {
      case "market":
        return (
          <input
            type="number"
            name="price"
            placeholder="Price (₹)"
            value={form.price}
            onChange={handleChange}
          />
        );
      case "tutoring":
        return (
          <>
            <input
              type="text"
              name="subject"
              placeholder="Subject"
              value={form.subject}
              onChange={handleChange}
            />
            <input
              type="number"
              name="fee"
              placeholder="Fee per hour (₹)"
              value={form.fee}
              onChange={handleChange}
            />
          </>
        );
      case "parttime":
      case "fulltime":
        return (
          <>
            <input
              type="text"
              name="company"
              placeholder="Company / Organization"
              value={form.company}
              onChange={handleChange}
            />
            <input
              type="text"
              name="location"
              placeholder="Job Location"
              value={form.location}
              onChange={handleChange}
            />
          </>
        );
      case "sports":
        return (
          <input
            type="text"
            name="sport"
            placeholder="Sport Name"
            value={form.sport}
            onChange={handleChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="post-form">
      <h3>
        {direction === "needed" ? "Requesting" : "Offering"} {activeService}
      </h3>

      <input
        type="text"
        name="title"
        placeholder="Title"
        value={form.title}
        onChange={handleChange}
        required
      />

      <textarea
        name="description"
        placeholder="Description..."
        value={form.description}
        onChange={handleChange}
        required
      />

      {renderExtraFields()}

      <button type="submit" disabled={loading}>
        {loading ? "Posting..." : "Post"}
      </button>
    </form>
  );
}

export default PostForm;
