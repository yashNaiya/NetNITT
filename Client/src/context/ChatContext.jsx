import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState([]); // array of emails
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    const s = io("http://localhost:3000", { auth: { token } });
    setSocket(s);

    s.on("connect", () => {});
    s.on("presence:update", (list) => setOnline(list));
    return () => { s.disconnect(); };
  }, [token]);

  const value = useMemo(() => ({ socket, online }), [socket, online]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
