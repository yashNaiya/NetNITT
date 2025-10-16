import { useEffect, useState, useRef } from "react";
import { useChat } from "../context/chatContext";
import "./Chat.css";

function toJSDate(neoTime) {
  if (!neoTime) return null;
  try {
    if (typeof neoTime === "string") return new Date(neoTime);
    if (neoTime.year && neoTime.month && neoTime.day) {
      const { year, month, day, hour, minute, second } = neoTime;
      return new Date(
        year.low || year,
        (month.low || month) - 1,
        day.low || day,
        hour?.low || hour || 0,
        minute?.low || minute || 0,
        second?.low || second || 0
      );
    }
    return new Date(neoTime);
  } catch {
    return null;
  }
}

export default function Chat() {
  const { socket, online } = useChat();
  const [inbox, setInbox] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const openRoomFromLocal = localStorage.getItem("openRoom");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load inbox
  useEffect(() => {
    const loadInbox = async () => {
      try {
        const res = await fetch("http://localhost:3000/chat/inbox", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setInbox(data.chats);
          if (openRoomFromLocal) {
            const found = data.chats.find((c) => c.roomId === openRoomFromLocal);
            if (found) {
              openRoom(found.roomId, found.otherName, found.otherEmail);
              localStorage.removeItem("openRoom");
            }
          }
        }
      } catch (err) {
        console.error("Error loading inbox:", err);
      }
    };
    loadInbox();
  }, [token]);

  const openRoom = async (roomId, name, email) => {
    setActiveRoom(roomId);
    setActiveUser({ name, email });
    try {
      const res = await fetch(`http://localhost:3000/chat/room/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages);
      socket?.emit("room:join", roomId);
    } catch (err) {
      console.error("Error loading room:", err);
    }
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onMessage = (payload) => {
      if (payload.roomId === activeRoom) {
        setMessages((prev) => [...prev, payload]);
      }
    };
    const onTyping = ({ roomId, email, typing }) => {
      if (roomId !== activeRoom) return;
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        typing ? updated.add(email) : updated.delete(email);
        return updated;
      });
    };
    const onSeen = ({ roomId }) => {
      if (roomId === activeRoom) {
        setMessages((prev) => prev.map((m) => ({ ...m, seen: true })));
      }
    };

    socket.on("room:message", onMessage);
    socket.on("room:typing", onTyping);
    socket.on("room:seen", onSeen);

    return () => {
      socket.off("room:message", onMessage);
      socket.off("room:typing", onTyping);
      socket.off("room:seen", onSeen);
    };
  }, [socket, activeRoom]);

 const sendMessage = () => {
  if (!newMsg.trim() || !activeRoom) return;

  const tempMsg = {
    id: Date.now().toString(),
    roomId: activeRoom,
    from: currentUser.email,
    content: newMsg.trim(),
    timestamp: new Date().toISOString(),
    seen: false,
  };

  // 👇 Immediately update the UI
  setMessages((prev) => [...prev, tempMsg]);

  // 👇 Emit to the backend
  socket.emit("room:message", { roomId: activeRoom, content: newMsg.trim() });

  // 👇 Clear input field
  setNewMsg("");

  // 👇 Notify "seen"
  setTimeout(() => socket.emit("room:seen", { roomId: activeRoom }), 100);
};


  const onTyping = (val) => {
    setNewMsg(val);
    socket?.emit("room:typing", { roomId: activeRoom, typing: val.length > 0 });
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <h2 className="sidebar-title">Messages</h2>
        <div className="chat-list">
          {inbox.length === 0 ? (
            <p className="muted">No conversations yet</p>
          ) : (
            inbox.map((chat) => (
              <div
                key={chat.roomId}
                className={`chat-item ${
                  activeRoom === chat.roomId ? "active" : ""
                }`}
                onClick={() =>
                  openRoom(chat.roomId, chat.otherName, chat.otherEmail)
                }
              >
                <div className="avatar">
                  {chat.otherName?.[0]?.toUpperCase() || "U"}
                  {online.includes(chat.otherEmail) && (
                    <span className="online-dot" />
                  )}
                </div>
                <div className="chat-item-info">
                  <h4>{chat.otherName}</h4>
                  <p className="muted small">{chat.otherEmail}</p>
                  <span className="time">
                    {toJSDate(chat.lastTime)
                      ? toJSDate(chat.lastTime).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "New"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="chat-main">
        {activeRoom ? (
          <>
            <div className="chat-header">
              <div>
                <h3>{activeUser?.name}</h3>
                <p className="muted small">{activeUser?.email}</p>
              </div>
              {typingUsers.size > 0 && (
                <div className="typing">typing...</div>
              )}
            </div>

            <div className="chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`chat-bubble ${
                    m.from === currentUser.email ? "sent" : "received"
                  }`}
                >
                  <p>{m.content}</p>
                  <span className="meta">
                    {toJSDate(m.timestamp)
                      ? toJSDate(m.timestamp).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Just now"}
                    {m.seen && " ✓✓"}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <input
                placeholder="Type a message..."
                value={newMsg}
                onChange={(e) => onTyping(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <div className="chat-empty">
            <h3>Select a chat to start messaging</h3>
          </div>
        )}
      </main>
    </div>
  );
}
