function ChatList({ users, onSelectUser, selectedUser }) {
  return (
    <ul>
      {users.map((u) => (
        <li
          key={u._id}
          onClick={() => onSelectUser(u)}
          style={{
            padding: "0.5rem",
            cursor: "pointer",
            background: selectedUser?._id === u._id ? "#eee" : "transparent",
          }}
        >
          {u.username}
        </li>
      ))}
    </ul>
  );
}
export default ChatList;
