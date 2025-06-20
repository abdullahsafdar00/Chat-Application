function MessageInput({ message, setMessage, sendMessage }) {
  return (
    <form onSubmit={sendMessage}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message"
      />
      <button type="submit">Send</button>
    </form>
  );
}
export default MessageInput;
