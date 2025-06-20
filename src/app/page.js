"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    const savedMessages = localStorage.getItem("gemini-chat-history");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("gemini-chat-history", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;
    const messagesForHistory = messages;
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);

    inputRef.current.value = "";
    setIsLoading(true);

    try {
      const history = messagesForHistory.map((msg) => ({
        role: msg.sender,
        text: msg.text,
      }));

      const response = await fetch(
        "https://gemini-ai-server-two.vercel.app/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
            history,
            historyLimit: 10,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();
      const botReply = data?.output || "No response from Gemini.";

      setMessages((prev) => [...prev, { sender: "model", text: botReply }]);
    } catch (error) {
      console.error("Error fetching response:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "model",
          text: "Failed to fetch response. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  };

  return (
    <div className="container">
      <h1>Gemini AI Chatbot</h1>
      <button
        onClick={() => {
          setMessages([]);
          localStorage.removeItem("gemini-chat-history");
        }}
        className="clear-chat mb-4"
      >
        Clear Chat
      </button>
      <div id="chat-box" className="chat-box" ref={chatBoxRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
          </div>
        ))}
        {isLoading && (
          <div className="message model">Gemini is thinking...</div>
        )}
      </div>
      <form id="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          id="user-input"
          placeholder="Type your message..."
          autoComplete="off"
          required
          ref={inputRef}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
