// -----------------------------
// LinkNITT Hackathon Backend
// -----------------------------

import express from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import cors from "cors";
import neo4j from "neo4j-driver";
import multer from "multer";
import nodemailer from "nodemailer";


const upload = multer({ dest: "uploads/" });

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"], // ✅ ADD THIS
  })
);

app.use(bodyParser.json());

// -----------------------------
// 1. Neo4j Connection Setup
// -----------------------------
const NEO4J_URI = "neo4j://127.0.0.1:7687"; // e.g. neo4j+s://abcd.databases.neo4j.io
const NEO4J_USER = "neo4j";
const NEO4J_PASS = "Yash@2330";

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));

const session = driver.session();

// Function to test Neo4j connection
async function testNeo4jConnection() {
  try {
    const result = await session.run("RETURN 'Neo4j connection successful' AS message");
    console.log("✅", result.records[0].get("message"));
  } catch (error) {
    console.error("❌ Neo4j connection failed:", error);
  }
}

// -----------------------------
// 2. Basic Auth (JWT)
// -----------------------------
const SECRET = "nitt_secret_key"; // use env var in production




// -----------------------------
// Register (User Signup)
// -----------------------------

app.post("/auth/register", async (req, res) => {
  const { name, email, password, role, department } = req.body;

  // ✅ Basic validations
  if (!name || !email || !password || !role || !department) {
    return res.status(400).json({ message: "All fields (name, email, password, role, department) are required" });
  }

  const allowedRoles = ["Student", "Faculty", "Alumni", "Staff"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role selected" });
  }

  const session = driver.session();

  try {
    // ✅ Check if user already exists
    const checkResult = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
      AND u.email = $email
      RETURN u
      `,
      { email }
    );

    if (checkResult.records.length > 0) {
      await session.close();
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // ✅ Create the user and link to department
    const result = await session.run(
      `
      MERGE (d:Department {name: $department})
      ON CREATE SET d.createdAt = datetime()

      CREATE (u:${role} {
        name: $name,
        email: $email,
        password: $password,
        role: $role,
        department: $department,
        verified: true,
        createdAt: datetime()
      })
      MERGE (u)-[:BELONGS_TO]->(d)
      RETURN u, d
      `,
      { name, email, password, role, department }
    );

    const user = result.records[0].get("u").properties;
    const dept = result.records[0].get("d").properties;

    // ✅ Create JWT
    const token = jwt.sign({ email, role }, SECRET, { expiresIn: "1h" });

    res.json({
      message: `${role} registered successfully in ${department}`,
      token,
      user,
      department: dept.name
    });
  } catch (err) {
    console.error("❌ Error creating user with department:", err);
    res.status(500).json({ message: "Error creating user" });
  } finally {
    await session.close();
  }
});




// Login (mock webmail auth)
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      RETURN u
      `,
      { email }
    );

    if (result.records.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.records[0].get("u").properties;

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // detect label (role) dynamically
    const labelResult = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      RETURN
        CASE
          WHEN u:Student THEN "Student"
          WHEN u:Faculty THEN "Faculty"
          WHEN u:Alumni THEN "Alumni"
          WHEN u:Staff THEN "Staff"
          ELSE "User"
        END AS role
      `,
      { email }
    );

    const role = labelResult.records[0].get("role");

    // JWT token
    const token = jwt.sign({ email, role }, SECRET, { expiresIn: "1h" });

    delete user.password; // don’t send password

    res.json({
      message: "Login successful",
      token,
      user: { ...user, role },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  } finally {
    await session.close();
  }
});


// Middleware for protected routes
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    console.log("❌ No Authorization header");
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.split(" ")[1];
  console.log("🔹 Token received:", token);

  try {
    req.user = jwt.verify(token, SECRET);
    console.log("✅ Token decoded:", req.user);
    next(); // very important
  } catch (err) {
    console.log("❌ JWT verification failed:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}


// ✅ Get current logged-in user's data
app.get("/auth/me", auth, async (req, res) => {
  const { email } = req.user;
  const session = driver.session();

  try {
    // Match any node with one of the 4 user roles
    const result = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      RETURN u
      `,
      { email }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.records[0].get("u").properties;
    delete user.password; // don’t send password

    res.json({ user });
  } catch (error) {
    console.error("❌ Error fetching user data:", error);
    res.status(500).json({ message: "Server error fetching user data" });
  } finally {
    await session.close();
  }
});


app.put("/user/update", auth, async (req, res) => {
  const { email } = req.user; // decoded from JWT
  const { about, location, currentRole, image } = req.body;
  const session = driver.session();

  try {
    // ✅ Update any type of user (Student, Faculty, Alumni, Staff)
    const result = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      SET 
        u.about = COALESCE($about, u.about),
        u.location = COALESCE($location, u.location),
        u.currentRole = COALESCE($currentRole, u.currentRole),
        u.image = COALESCE($image, u.image),
        u.updatedAt = datetime()
      RETURN u
      `,
      { email, about, location, currentRole, image }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = result.records[0].get("u").properties;
    delete updatedUser.password;

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    res.status(500).json({ message: "Server error while updating profile" });
  } finally {
    await session.close();
  }
});




// Create a post


app.post("/post/create", auth, async (req, res) => {
  const {
    type,
    title,
    description,
    price = null,
    location = null,
    company = null,
    subject = null,
    fee = null,
    sport = null,
    extra = null,
    direction = "offered",
  } = req.body;

  const email = req.user.email;
  const session = driver.session();

  const labelMap = {
    market: "MarketPost",
    food: "FoodPost",
    tutoring: "TutoringPost",
    mentorship: "MentorshipPost",
    parttime: "PartTimeJob",
    fulltime: "FullTimeJob",
    sports: "SportsPost",
    general: "GeneralPost",
  };

  const label = labelMap[type];
  if (!label) return res.status(400).json({ message: "Invalid or missing post type" });

  try {
    const relationType = direction === "needed" ? "NEEDS" : "OFFERS";

    const result = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      WITH u LIMIT 1                            // ✅ only one user node
      MERGE (u)-[:${relationType}]->(p:${label} {id: randomUUID()})
      SET p.title = $title,
          p.description = $description,
          p.type = $type,
          p.direction = $direction,
          p.price = $price,
          p.location = $location,
          p.company = $company,
          p.subject = $subject,
          p.fee = $fee,
          p.sport = $sport,
          p.extra = $extra,
          p.createdAt = datetime()
      RETURN p {.*, createdAt: toString(p.createdAt)} AS post
      `,
      {
        email,
        type,
        direction,
        title,
        description,
        price,
        location,
        company,
        subject,
        fee,
        sport,
        extra,
      }
    );

    if (!result.records.length) {
      return res.status(500).json({ message: "Failed to create post" });
    }

    const post = result.records[0].get("post");

    res.json({
      message: `${direction === "needed" ? "Need" : "Offer"} ${label} created successfully`,
      post,
    });
  } catch (err) {
    console.error("❌ Error creating post:", err);
    res.status(500).json({ message: "Error creating post", error: err.message });
  } finally {
    await session.close();
  }
});

// Get all posts
app.get("/post/:type", auth, async (req, res) => {
  const { type } = req.params;
  const direction = req.query.direction || "offered";
  const email = req.user.email;
  const session = driver.session();

  const labelMap = {
    market: "MarketPost",
    food: "FoodPost",
    tutoring: "TutoringPost",
    mentorship: "MentorshipPost",
    parttime: "PartTimeJob",
    fulltime: "FullTimeJob",
    sports: "SportsPost",
    general: "GeneralPost",
  };

  const label = labelMap[type];
  if (!label) {
    return res.status(400).json({ message: "Invalid post type" });
  }

  // ✅ Select relationship type dynamically
  const relType = direction === "needed" ? "NEEDS" : "OFFERS";

  try {
    const result = await session.run(
      `
      MATCH (owner)-[:${relType}]->(p:${label})
      WHERE owner.email <> $email
      RETURN 
        p.id AS id,
        p.title AS title,
        p.description AS description,
        p.type AS type,
        p.direction AS direction,
        p.price AS price,
        p.location AS location,
        p.company AS company,
        p.subject AS subject,
        p.fee AS fee,
        p.sport AS sport,
        p.createdAt AS createdAt,
        owner.name AS postedBy,
        labels(owner)[0] AS role,
        owner.image AS image
      ORDER BY p.createdAt DESC
      `,
      { email }
    );

    const posts = result.records.map((r) => ({
      id: r.get("id"),
      title: r.get("title"),
      description: r.get("description"),
      type: r.get("type"),
      direction: r.get("direction"),
      price: r.get("price"),
      location: r.get("location"),
      company: r.get("company"),
      subject: r.get("subject"),
      fee: r.get("fee"),
      sport: r.get("sport"),
      createdAt: r.get("createdAt"),
      postedBy: r.get("postedBy"),
      role: r.get("role"),
      image: r.get("image"),
    }));

    res.json({ posts });
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({ message: "Error fetching posts" });
  } finally {
    await session.close();
  }
});


app.get("/user/posts", auth, async (req, res) => {
  const email = req.user.email;
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u {email:$email})-[:OFFERS|NEEDS]->(p)
      WHERE (p:MarketPost OR p:FoodPost OR p:TutoringPost OR p:MentorshipPost OR
             p:PartTimeJob OR p:FullTimeJob OR p:SportsPost OR p:GeneralPost)
      RETURN 
        labels(p)[0] AS postLabel,
        p.id AS id,
        p.title AS title,
        p.description AS description,
        p.type AS type,
        p.direction AS direction,
        p.price AS price,
        p.location AS location,
        p.company AS company,
        p.subject AS subject,
        p.fee AS fee,
        p.sport AS sport,
        p.extra AS extra,
        toString(p.createdAt) AS createdAt
      ORDER BY p.createdAt DESC
      `,
      { email }
    );

    const posts = result.records.map((r) => ({
      id: r.get("id"),
      title: r.get("title"),
      description: r.get("description"),
      type: r.get("type"),
      direction: r.get("direction"),
      price: r.get("price"),
      location: r.get("location"),
      company: r.get("company"),
      subject: r.get("subject"),
      fee: r.get("fee"),
      sport: r.get("sport"),
      extra: r.get("extra"),
      postLabel: r.get("postLabel"),
      createdAt: r.get("createdAt"),
    }));

    res.json({ posts });
  } catch (error) {
    console.error("❌ Error fetching user posts:", error);
    res.status(500).json({ message: "Error fetching posts" });
  } finally {
    await session.close();
  }
});





app.put("/posts/update/:id", auth, async (req, res) => {
  const { id } = req.params;
  const email = req.user.email;
  const {
    title,
    description,
    price,
    location,
    company,
    subject,
    fee,
    sport,
    extra,
  } = req.body;

  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u {email:$email})-[:OFFERS|NEEDS]->(p)
      WHERE p.id = $id
      SET
        p.title = COALESCE($title, p.title),
        p.description = COALESCE($description, p.description),
        p.price = COALESCE($price, p.price),
        p.location = COALESCE($location, p.location),
        p.company = COALESCE($company, p.company),
        p.subject = COALESCE($subject, p.subject),
        p.fee = COALESCE($fee, p.fee),
        p.sport = COALESCE($sport, p.sport),
        p.extra = COALESCE($extra, p.extra)
      RETURN p {.*, createdAt: toString(p.createdAt)} AS post
      `,
      {
        id,
        email,
        title,
        description,
        price,
        location,
        company,
        subject,
        fee,
        sport,
        extra,
      }
    );

    if (!result.records.length)
      return res.status(404).json({ message: "Post not found or not yours" });

    res.json({
      message: "Post updated successfully",
      post: result.records[0].get("post"),
    });
  } catch (err) {
    console.error("❌ Error updating post:", err);
    res.status(500).json({ message: "Error updating post" });
  } finally {
    await session.close();
  }
});

app.delete("/posts/delete/:id", auth, async (req, res) => {
  const { id } = req.params;
  const { email } = req.user;
  const session = driver.session();

  try {
    // Match user by any role and delete connected post
    const result = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Staff OR u:Alumni)
        AND u.email = $email
      MATCH (u)-[r:OFFERS|NEEDS]->(p)
      WHERE p.id = $id
      DETACH DELETE p
      RETURN count(p) AS deletedCount
      `,
      { email, id }
    );

    const deletedCount =
      result.records[0]?.get("deletedCount")?.toNumber?.() || 0;

    if (deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "Post not found or not associated with this user" });
    }

    res.json({ message: "✅ Post deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting post:", error);
    res.status(500).json({ message: "Server error while deleting post" });
  } finally {
    await session.close();
  }
});


app.post("/interest/create", auth, async (req, res) => {
  const email = req.user.email;
  const { postId, message = "" } = req.body;
  const session = driver.session();

  try {
    // 🔍 Verify that the post exists (regardless of its label)
    const result = await session.run(
      `
      MATCH (p)
      WHERE (p:MarketPost OR p:FoodPost OR p:TutoringPost OR p:MentorshipPost OR 
             p:PartTimeJob OR p:FullTimeJob OR p:SportsPost OR p:GeneralPost)
        AND p.id = $postId
      RETURN p
      `,
      { postId }
    );

    if (!result.records.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 🧠 Create or update the INTERESTED_IN relationship
    const createInterest = await session.run(
      `
      MATCH (u)
      WHERE (u:Student OR u:Faculty OR u:Alumni OR u:Staff)
        AND u.email = $email
      WITH u
      MATCH (p)
      WHERE (p:MarketPost OR p:FoodPost OR p:TutoringPost OR p:MentorshipPost OR 
             p:PartTimeJob OR p:FullTimeJob OR p:SportsPost OR p:GeneralPost)
        AND p.id = $postId
      MERGE (u)-[r:INTERESTED_IN]->(p)
      ON CREATE SET 
        r.message = $message,
        r.createdAt = datetime(),
        r.status = "pending"
      ON MATCH SET
        r.message = CASE WHEN $message <> "" THEN $message ELSE r.message END,
        r.updatedAt = datetime()
      RETURN p {.*, createdAt: toString(p.createdAt)} AS post, r.status AS status
      `,
      { email, postId, message }
    );

    if (!createInterest.records.length) {
      return res.status(500).json({ message: "Failed to record interest" });
    }

    const post = createInterest.records[0].get("post");
    const status = createInterest.records[0].get("status");

    res.json({
      message: `Interest recorded successfully (${status})`,
      post,
    });
  } catch (err) {
    console.error("❌ Error creating interest:", err);
    res.status(500).json({ message: "Error creating interest", error: err.message });
  } finally {
    await session.close();
  }
});


// ✅ Received Interests API (for post owners)
// app.get("/interest/received", auth, async (req, res) => {
//   const ownerEmail = req.user.email;
//   const session = driver.session();

//   try {
//     const result = await session.run(
//       `
//       MATCH (owner {email:$ownerEmail})
//       OPTIONAL MATCH (user)-[r:INTERESTED_IN]->(p)
//       WHERE (p:MarketPost OR p:FoodPost OR p:TutoringPost OR p:MentorshipPost OR 
//              p:PartTimeJob OR p:FullTimeJob OR p:SportsPost OR p:GeneralPost)
//         AND (owner)-[:OFFERS|NEEDS]->(p)
//       RETURN
//         labels(p)[0] AS postLabel,
//         p.id AS postId,
//         p.title AS postTitle,
//         p.direction AS direction,
//         p.type AS type,
//         user.name AS userName,
//         user.email AS userEmail,
//         r.message AS message,
//         COALESCE(r.status, "pending") AS status,
//         toString(r.createdAt) AS createdAt
//       ORDER BY r.createdAt DESC
//       `,
//       { ownerEmail }
//     );

//     const interests = result.records.map((r) => ({
//       postId: r.get("postId"),
//       postLabel: r.get("postLabel"),
//       postTitle: r.get("postTitle"),
//       direction: r.get("direction"),
//       type: r.get("type"),
//       userName: r.get("userName"),
//       userEmail: r.get("userEmail"),
//       message: r.get("message"),
//       status: r.get("status"),
//       createdAt: r.get("createdAt"),
//     }));

//     res.json({ interests });
//   } catch (err) {
//     console.error("Error fetching received interests:", err);
//     res.status(500).json({ message: "Error fetching received interests" });
//   } finally {
//     await session.close();
//   }
// });


app.post("/post/details", auth, async (req, res) => {
  const { id } = req.body;
  const session = driver.session();

  if (!id) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  try {
    const query = `
      MATCH (p:MarketPost|FoodPost|TutoringPost|MentorshipPost|PartTimeJob|FullTimeJob|SportsPost|GeneralPost)
      WHERE p.id = $id
      OPTIONAL MATCH (owner:Student|Faculty|Staff|Alumni)-[:OFFERS|NEEDS]->(p)
      OPTIONAL MATCH (interested:Student|Faculty|Staff|Alumni)-[r:INTERESTED_IN]->(p)
      RETURN 
        p {.*, createdAt: toString(p.createdAt)} AS post,
        owner.name AS ownerName,
        owner.email AS ownerEmail,
        collect({
          userName: interested.name,
          userEmail: interested.email,
          message: r.message,
          status: COALESCE(r.status, "pending"),
          createdAt: toString(r.createdAt)
        }) AS interests
    `;

    const result = await session.run(query, { id });

    if (!result.records.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    const record = result.records[0];
    const post = record.get("post");
    const owner = {
      name: record.get("ownerName"),
      email: record.get("ownerEmail"),
    };
    const interests = record
      .get("interests")
      .filter((i) => i.userEmail && i.userName);

    res.json({ post, owner, interests });
  } catch (error) {
    console.error("❌ Error fetching post details:", error);
    res.status(500).json({ message: "Error fetching post details" });
  } finally {
    await session.close();
  }
});



// ✅ Accept interest and open chat
app.post("/interest/accept", auth, async (req, res) => {
  const { postId, userEmail } = req.body;
  const currentUserEmail = req.user.email;
  const session = driver.session();

  try {
    const result = await session.run(
      `
  MATCH (owner:Student|Faculty|Staff|Alumni {email: $currentUserEmail})
  MATCH (user:Student|Faculty|Staff|Alumni {email: $userEmail})
  MATCH (user)-[r:INTERESTED_IN]->(p {id: $postId})
  DELETE r

  // Create a new ChatRoom node
  CREATE (chat:ChatRoom {
    id: randomUUID(),
    postId: $postId,
    createdAt: datetime()
  })

  // Connect both users to the chat room
  CREATE (owner)-[:IN_ROOM]->(chat)
  CREATE (user)-[:IN_ROOM]->(chat)

  RETURN chat.id AS roomId
  `,
      { currentUserEmail, userEmail, postId }
    );

if (!result.records.length) {
  return res.status(404).json({
    message: "No valid interest found or users not matched.",
  });
}

const roomId = result.records[0].get("roomId");
res.json({
  message: "Interest accepted successfully, chat room created.",
  roomId,
});
  } catch (error) {
  console.error("❌ Error accepting interest:", error);
  res.status(500).json({ message: "Server error while accepting interest" });
} finally {
  await session.close();
}
});


app.post("/interest/reject", auth, async (req, res) => {
  const { postId, userEmail } = req.body;
  const ownerEmail = req.user.email;
  const session = driver.session();

  try {
    // Step 1️⃣ — Ensure the post belongs to this owner
    const verify = await session.run(
      `
      MATCH (owner {email: $ownerEmail})-[:OFFERS|NEEDS]->(p)
      WHERE p.id = $postId
      RETURN p
      `,
      { ownerEmail, postId }
    );

    if (verify.records.length === 0) {
      return res.status(403).json({ message: "You cannot reject interest on this post." });
    }

    // Step 2️⃣ — Delete or mark as rejected
    const result = await session.run(
      `
      MATCH (user {email: $userEmail})-[r:INTERESTED_IN]->(p {id: $postId})
      SET r.status = "rejected", r.updatedAt = datetime()
      RETURN user.name AS userName, p.title AS postTitle
      `,
      { userEmail, postId }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ message: "Interest not found for this post." });
    }

    res.json({
      message: "Interest rejected successfully.",
    });
  } catch (error) {
    console.error("❌ Error rejecting interest:", error);
    res.status(500).json({ message: "Server error while rejecting interest." });
  } finally {
    await session.close();
  }
});



// connections
// ✅ Updated APIs (matching current database structure with role-specific user nodes)

// Search users
app.get("/users/search", auth, async (req, res) => {
  const q = req.query.q?.toLowerCase() || "";
  const email = req.user.email;
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:Student|Faculty|Staff|Alumni)
      WHERE (toLower(u.name) CONTAINS $q OR toLower(u.role) CONTAINS $q)
      AND u.email <> $email
      RETURN ID(u) AS id,
             u.name AS name,
             u.role AS role,
             u.location AS location,
             u.currentRole AS currentRole,
             u.image AS image,
             u.about AS about
      LIMIT 10
      `,
      { q, email }
    );

    const users = result.records.map((r) => ({
      id: r.get("id").low ?? r.get("id"),
      name: r.get("name"),
      role: r.get("role"),
      location: r.get("location"),
      currentRole: r.get("currentRole"),
      image: r.get("image"),
      about: r.get("about"),
    }));

    res.json({ users });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// Get public profile by ID
app.get("/users/id/:id", auth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:Student|Faculty|Staff|Alumni)
      WHERE ID(u) = $userId
      RETURN {
        name: u.name,
        role: u.role,
        email: u.email,
        location: u.location,
        currentRole: u.currentRole,
        about: u.about,
        image: u.image
      } AS user
      `,
      { userId }
    );

    if (!result.records.length)
      return res.status(404).json({ message: "User not found" });

    const user = result.records[0].get("user");
    res.json({ user });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// Get all posts of a specific user
app.get("/user/:id/posts", auth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:Student|Faculty|Staff|Alumni)-[:OFFERS|NEEDS]->(p)
      WHERE ID(u) = $userId
      RETURN p { .id, .title, .description, .type, .direction, .price, createdAt: toString(p.createdAt) } AS post
      ORDER BY p.createdAt DESC
      `,
      { userId }
    );

    const posts = result.records.map((r) => r.get("post"));
    res.json({ posts });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Connection Request, Accept, Reject, List, Status, Sent, Received APIs — updated to support all role-based users

app.post("/connections/request", auth, async (req, res) => {
  const { targetId } = req.body;
  const userEmail = req.user.email;
  const session = driver.session();
  const id = parseInt(targetId, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid target ID" });

  try {
    const result = await session.run(
      `
      MATCH (me:Student|Faculty|Staff|Alumni {email:$userEmail}), (other)
      WHERE ID(other) = $id AND (other:Student OR other:Faculty OR other:Staff OR other:Alumni)
      OPTIONAL MATCH (me)-[r:SENT_REQUEST|CONNECTED]-(other)
      RETURN COUNT(r) AS existing
      `,
      { userEmail, id }
    );

    const existing = result.records[0].get("existing").toNumber();
    if (existing > 0) return res.json({ message: "Request or connection already exists" });

    await session.run(
      `MATCH (a:Student|Faculty|Staff|Alumni {email:$userEmail}), (b)
       WHERE ID(b)=$id AND (b:Student OR b:Faculty OR b:Staff OR b:Alumni)
       CREATE (a)-[:SENT_REQUEST {createdAt:datetime()}]->(b)`,
      { userEmail, id }
    );

    res.json({ message: "Connection request sent" });
  } catch (err) {
    console.error("connections/request error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Connection status
app.get("/connections/status/:id", auth, async (req, res) => {
  const userEmail = req.user.email;
  const id = parseInt(req.params.id, 10);
  const session = driver.session();

  try {
    const result = await session.run(
      `MATCH (a:Student|Faculty|Staff|Alumni {email:$userEmail}), (b)
       WHERE ID(b)=$id AND (b:Student OR b:Faculty OR b:Staff OR b:Alumni)
       OPTIONAL MATCH (a)-[out:SENT_REQUEST]->(b)
       OPTIONAL MATCH (b)-[in:SENT_REQUEST]->(a)
       OPTIONAL MATCH (a)-[c:CONNECTED]-(b)
       RETURN CASE
         WHEN c IS NOT NULL THEN 'connected'
         WHEN out IS NOT NULL THEN 'outgoing'
         WHEN in IS NOT NULL THEN 'incoming'
         ELSE 'none'
       END AS status` ,
      { userEmail, id }
    );
    res.json({ status: result.records[0]?.get("status") || "none" });
  } catch (err) {
    console.error("connections/status error:", err);
    res.status(500).json({ status: "none" });
  } finally {
    await session.close();
  }
});

// ✅ Withdraw request
app.post("/connections/withdraw", auth, async (req, res) => {
  const { targetId } = req.body;
  const userEmail = req.user.email;
  const id = parseInt(targetId, 10);
  const session = driver.session();

  try {
    await session.run(
      `MATCH (a:Student|Faculty|Staff|Alumni {email:$userEmail})-[r:SENT_REQUEST]->(b)
       WHERE ID(b)=$id DELETE r`,
      { userEmail, id }
    );
    res.json({ message: "Request withdrawn" });
  } catch (err) {
    console.error("connections/withdraw error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Received requests
app.get("/connections/received", auth, async (req, res) => {
  const userEmail = req.user.email;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (sender:Student|Faculty|Staff|Alumni)-[r:SENT_REQUEST]->(me {email:$userEmail})
       RETURN ID(sender) AS id, sender.name AS name, sender.role AS role, sender.image AS image, r.createdAt AS createdAt
       ORDER BY r.createdAt DESC`,
      { userEmail }
    );
    const requests = result.records.map((r) => ({
      id: r.get("id").low ?? r.get("id"),
      name: r.get("name"),
      role: r.get("role"),
      image: r.get("image"),
      createdAt: r.get("createdAt"),
    }));
    res.json({ requests });
  } catch (err) {
    console.error("connections/received error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Connections list
app.get("/connections/list", auth, async (req, res) => {
  const userEmail = req.user.email;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Student|Faculty|Staff|Alumni {email:$userEmail})-[:CONNECTED]-(b)
       RETURN ID(b) AS id, b.name AS name, b.role AS role, b.image AS image
       ORDER BY b.name`,
      { userEmail }
    );
    const connections = result.records.map((r) => ({
      id: r.get("id").low ?? r.get("id"),
      name: r.get("name"),
      role: r.get("role"),
      image: r.get("image"),
    }));
    res.json({ connections });
  } catch (err) {
    console.error("connections/list error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Sent requests
app.get("/connections/sent", auth, async (req, res) => {
  const userEmail = req.user.email;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Student|Faculty|Staff|Alumni {email:$userEmail})-[r:SENT_REQUEST]->(b)
       RETURN ID(b) AS id, b.name AS name, b.role AS role, b.image AS image, r.createdAt AS createdAt
       ORDER BY r.createdAt DESC`,
      { userEmail }
    );
    const requests = result.records.map((r) => ({
      id: r.get("id").low ?? r.get("id"),
      name: r.get("name"),
      role: r.get("role"),
      image: r.get("image"),
      createdAt: r.get("createdAt"),
    }));
    res.json({ requests });
  } catch (err) {
    console.error("connections/sent error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});

// ✅ Respond to connection request (Accept/Reject)
app.post("/connections/respond", auth, async (req, res) => {
  const { senderId, action } = req.body;
  const userEmail = req.user.email;
  const session = driver.session();
  const id = parseInt(senderId, 10);

  try {
    if (action === "accept") {
      await session.run(
        `MATCH (sender:Student|Faculty|Staff|Alumni)-[r:SENT_REQUEST]->(me {email:$userEmail})
         WHERE ID(sender)=$id
         DELETE r
         MERGE (sender)-[:CONNECTED {since:datetime()}]->(me)
         MERGE (me)-[:CONNECTED {since:datetime()}]->(sender)` ,
        { userEmail, id }
      );
      res.json({ message: "Connection accepted" });
    } else {
      await session.run(
        `MATCH (sender:Student|Faculty|Staff|Alumni)-[r:SENT_REQUEST]->(me {email:$userEmail})
         WHERE ID(sender)=$id DELETE r`,
        { userEmail, id }
      );
      res.json({ message: "Connection rejected" });
    }
  } catch (err) {
    console.error("connections/respond error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    await session.close();
  }
});


//recommendation system--------------------------------------------------------------------------------


// 📍 Enhanced Recommendations API
app.get("/feed/recommended", auth, async (req, res) => {
  const userEmail = req.user.email;
  const { service } = req.query; // ← optional filter from frontend
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (me:User {email:$userEmail})-[:CONNECTED]-(friend:User)
      MATCH (friend)-[:POSTED]->(p)
      WHERE NOT (p)<-[:INTERESTED_IN]-(:User {email:$userEmail})
        AND p.title IS NOT NULL
        AND p.description IS NOT NULL
        ${service ? "AND toLower(p.type) = toLower($service)" : ""}

      WITH p, friend, p.timestamp AS ts, size((friend)-[:POSTED]->()) AS postCount
      RETURN DISTINCT
        ID(p) AS id,
        p.title AS title,
        p.description AS description,
        p.type AS category,
        p.direction AS direction,
        p.price AS price,
        p.location AS location,
        p.timestamp AS timestamp,
        friend.name AS postedBy,
        friend.role AS role,
        friend.image AS image,
        postCount
      ORDER BY postCount DESC, timestamp DESC
      LIMIT 25
      `,
      { userEmail, service }
    );

    // 🧹 Filter out null posts (safety check)
    const posts = result.records
      .map((r) => ({
        id: r.get("id")?.low ?? r.get("id"),
        title: r.get("title"),
        description: r.get("description"),
        category: r.get("category"),
        direction: r.get("direction"),
        price: r.get("price"),
        location: r.get("location"),
        timestamp: r.get("timestamp"),
        postedBy: r.get("postedBy"),
        role: r.get("role"),
        image: r.get("image"),
      }))
      .filter((p) => p && p.id && p.title && p.description); 

    res.json({ posts });
  } catch (err) {
    console.error("❌ Error fetching recommended posts:", err);
    res.status(500).json({ message: "Error fetching recommended posts" });
  } finally {
    await session.close();
  }
});








// chat box

// --- GET all chat rooms for the logged-in user ---
app.get("/chat/inbox", auth, async (req, res) => {
  const email = req.user.email;
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (me:Student|Faculty|Alumni|Staff {email:$email})-[:IN_ROOM]->(c:ChatRoom)
      OPTIONAL MATCH (other:Student|Faculty|Alumni|Staff)-[:IN_ROOM]->(c)
      WHERE other.email <> $email
      OPTIONAL MATCH (sender:Student|Faculty|Alumni|Staff)-[m:SENT_MESSAGE]->(c)
      WITH c, other, max(m.timestamp) AS lastTime
      RETURN 
        c.id AS roomId,
        c.postId AS postId,
        other.name AS otherName,
        other.email AS otherEmail,
        lastTime
      ORDER BY lastTime DESC
      `,
      { email }
    );

    const chats = result.records.map((r) => ({
      roomId: r.get("roomId"),
      postId: r.get("postId"),
      otherName: r.get("otherName"),
      otherEmail: r.get("otherEmail"),
      lastTime: r.get("lastTime"),
    }));

    res.json({ chats });
  } catch (err) {
    console.error("❌ Error fetching inbox:", err);
    res.status(500).json({ message: "Error fetching inbox" });
  } finally {
    await session.close();
  }
});

// ✅ Create or fetch ChatRoom between two connected users
app.post("/chat/start", auth, async (req, res) => {
  const { targetId } = req.body;
  const userEmail = req.user.email;
  const session = driver.session();

  try {
    // 1️⃣  Check if a ChatRoom already exists between both users
    const existing = await session.run(
      `
      MATCH (me:Student|Faculty|Staff|Alumni {email:$userEmail}),
            (other)
      WHERE ID(other) = $targetId
      OPTIONAL MATCH (me)-[:IN_ROOM]->(room:ChatRoom)<-[:IN_ROOM]-(other)
      RETURN room.id AS roomId
      `,
      { userEmail, targetId: parseInt(targetId, 10) }
    );

    // 2️⃣  If a room exists, return it
    const existingRoom = existing.records[0]?.get("roomId");
    if (existingRoom) {
      return res.json({ roomId: existingRoom });
    }

    // 3️⃣  Otherwise create a new ChatRoom node + IN_ROOM relations
    const create = await session.run(
      `
      MATCH (me:Student|Faculty|Staff|Alumni {email:$userEmail}),
            (other)
      WHERE ID(other) = $targetId
      CREATE (r:ChatRoom {id: randomUUID(), createdAt: datetime()})
      MERGE (me)-[:IN_ROOM]->(r)
      MERGE (other)-[:IN_ROOM]->(r)
      RETURN r.id AS roomId
      `,
      { userEmail, targetId: parseInt(targetId, 10) }
    );

    const roomId = create.records[0]?.get("roomId");
    if (!roomId)
      return res.status(500).json({ message: "Failed to create chat room" });

    res.json({ roomId });
  } catch (err) {
    console.error("❌ Error creating chat room:", err);
    res.status(500).json({ message: "Server error while creating chat room" });
  } finally {
    await session.close();
  }
});



// --- GET messages of a particular chat room ---
app.get("/chat/room/:roomId", auth, async (req, res) => {
  const { roomId } = req.params;
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (u:Student|Faculty|Alumni|Staff)-[m:SENT_MESSAGE]->(c:ChatRoom {id:$roomId})
      RETURN 
        m.id AS id,
        u.email AS from,
        m.content AS content,
        m.timestamp AS timestamp,
        m.seen AS seen
      ORDER BY m.timestamp ASC
      `,
      { roomId }
    );

    const messages = result.records.map((r) => ({
      id: r.get("id"),
      from: r.get("from"),
      content: r.get("content"),
      timestamp: r.get("timestamp"),
      seen: r.get("seen"),
    }));

    res.json({ messages });
  } catch (err) {
    console.error("❌ Error fetching chat room:", err);
    res.status(500).json({ message: "Error fetching chat room" });
  } finally {
    await session.close();
  }
});




import http from "http";
import { Server } from "socket.io";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

// ---- Authenticate socket using JWT ----
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing token"));
    const payload = jwt.verify(token, SECRET);
    socket.user = { email: payload.email };
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// ---- Utility: Save message in Neo4j ----
async function persistMessage({ roomId, fromEmail, content }) {
  const session = driver.session();
  try {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await session.run(
      `
      MATCH (u:Student|Faculty|Alumni|Staff {email:$fromEmail})
      MATCH (c:ChatRoom {id:$roomId})
      CREATE (u)-[m:SENT_MESSAGE {
        id: $msgId,
        content: $content,
        timestamp: datetime(),
        seen: false
      }]->(c)
      RETURN m
      `,
      { roomId, fromEmail, content, msgId }
    );

    return result.records[0]?.get("m").properties;
  } finally {
    await session.close();
  }
}

// ---- Utility: Mark messages as seen ----
async function markSeen({ roomId, userEmail }) {
  const session = driver.session();
  try {
    await session.run(
      `
      MATCH (sender:Student|Faculty|Alumni|Staff)-[m:SENT_MESSAGE]->(c:ChatRoom {id:$roomId})
      WHERE sender.email <> $userEmail AND m.seen = false
      SET m.seen = true
      RETURN count(m)
      `,
      { roomId, userEmail }
    );
  } finally {
    await session.close();
  }
}

// ---- Presence tracking ----
const onlineUsers = new Map(); // email → Set(socketIds)
const addOnline = (email, id) => {
  if (!onlineUsers.has(email)) onlineUsers.set(email, new Set());
  onlineUsers.get(email).add(id);
};
const removeOnline = (email, id) => {
  if (!onlineUsers.has(email)) return;
  const set = onlineUsers.get(email);
  set.delete(id);
  if (set.size === 0) onlineUsers.delete(email);
};

// ---- Socket event handlers ----
io.on("connection", (socket) => {
  const { email } = socket.user;
  addOnline(email, socket.id);
  io.emit("presence:update", Array.from(onlineUsers.keys()));

  // ✅ Join room
  socket.on("room:join", async (roomId) => {
    socket.join(roomId);
    await markSeen({ roomId, userEmail: email });
    io.to(roomId).emit("room:seen", { roomId, by: email });
  });

  // ✅ Typing indicator
  socket.on("room:typing", ({ roomId, typing }) => {
    socket.to(roomId).emit("room:typing", { roomId, email, typing });
  });

  // ✅ Send message
  socket.on("room:message", async ({ roomId, content }) => {
    if (!content?.trim()) return;
    const msg = await persistMessage({ roomId, fromEmail: email, content });

    // Send to others in room (but not back to sender)
    socket.to(roomId).emit("room:message", {
      id: msg.id,
      from: email,
      roomId,
      content: msg.content,
      timestamp: msg.timestamp,
      seen: false,
    });

    // (Optional) you can send acknowledgment back to sender only if needed
    socket.emit("room:ack", { id: msg.id });
  });


  // ✅ Mark messages as seen
  socket.on("room:seen", async ({ roomId }) => {
    await markSeen({ roomId, userEmail: email });
    io.to(roomId).emit("room:seen", { roomId, by: email });
  });

  // ✅ Disconnect cleanup
  socket.on("disconnect", () => {
    removeOnline(email, socket.id);
    io.emit("presence:update", Array.from(onlineUsers.keys()));
  });
});

// -----------------------------
// 8. Server Start
// -----------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`✅ API & Socket server on http://localhost:${PORT}`);
  await testNeo4jConnection();
});



