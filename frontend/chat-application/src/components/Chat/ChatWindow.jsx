import { forwardRef } from "react";

const ChatWindow = forwardRef(({ chatHistory }, ref) => (
  <div style={{ height: "400px", overflowY: "scroll" }}>
    {chatHistory.map((msg, idx) => (
      <div key={idx}>
        <b>{msg.senderName}:</b> {msg.message}
      </div>
    ))}
    <div ref={ref}></div>
  </div>
));

export default ChatWindow;
