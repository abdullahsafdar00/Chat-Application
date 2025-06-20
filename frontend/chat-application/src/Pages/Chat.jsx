import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const Chat = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [draftMessages, setDraftMessages] = useState({});
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // ✅ Load token & user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      setToken(token);
      setUser(parsedUser);
    }
  }, []);

  // ✅ Load conversations when user is available
  useEffect(() => {
    if (user?._id && token) {
      fetchConversations();
    }
  }, [user, token]);

  // ✅ Window focus tracking for notifications
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // ✅ Socket.IO connection and real-time features
  useEffect(() => {
    if (user?._id) {
      // Initialize socket connection
      socketRef.current = io('http://localhost:3000');

      // Emit user connected event
      socketRef.current.emit('user_connected', user._id);

      // Listen for online users updates
      socketRef.current.on('update_online_users', (users) => {
        setOnlineUsers(users);
      });

      // Listen for incoming messages (only from other users)
      socketRef.current.on('receive_message', (messageData) => {
        // Only add message if it's from another user to the current user
        if (messageData.sender !== user._id && messageData.receiver === user._id) {
          setChatHistory(prev => [...prev, messageData]);

          // Show notification if window is not focused
          if (!isWindowFocused && 'Notification' in window && Notification.permission === 'granted') {
            const senderName = messageData.senderName || 'Someone';
            new Notification(`New message from ${senderName}`, {
              body: messageData.message,
              icon: '/favicon.ico', // You can add a custom icon
              tag: `message-${messageData.sender}`, // Prevents duplicate notifications
            });
          }

          // Refresh conversations to update last message and unread count
          fetchConversations();
        }
      });

      // Listen for typing indicators
      socketRef.current.on('user_typing', ({ userId, isTyping: typing }) => {
        setTypingUsers(prev => ({
          ...prev,
          [userId]: typing
        }));
      });

      // Cleanup on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [user, selectedUser]);

// Fetch recent conversations with last message details
const fetchConversations = async () => {
  if (!user?._id || !token) return;

  try {
    const res = await axios.get(`http://localhost:3000/api/chat/conversations/${user._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setConversations(res.data);
  } catch (err) {
    console.error('Failed to fetch conversations:', err);
  }
};

const fetchAllUsers = async () => {
  if (!user?._id || !token) {
    console.warn('User or token not ready');
    return;
  }

  try {
    const res = await axios.get(`http://localhost:3000/api/users/all/${user._id}`);
    const users = res.data.filter((u) => u._id !== user._id);
    setAllUsers(users);
    setShowAllUsers(true);
  } catch (err) {
    console.error('Failed to fetch users:', err);
  }
};


  const fetchChatHistory = async (u) => {
    if (!user?._id || !u?._id) return;

    // Save current draft message before switching
    if (selectedUser && message.trim()) {
      setDraftMessages(prev => ({
        ...prev,
        [selectedUser._id]: message
      }));
    }

    setSelectedUser(u);

    try {
      const res = await axios.get(`http://localhost:3000/api/chat/history/${user._id}/${u._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChatHistory(res.data);

      // Restore draft message for this conversation
      const draftMessage = draftMessages[u._id] || '';
      setMessage(draftMessage);
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const messageText = message.trim();
    setMessage(''); // Clear input immediately for better UX

    // Clear draft message for this conversation
    if (selectedUser) {
      setDraftMessages(prev => {
        const newDrafts = { ...prev };
        delete newDrafts[selectedUser._id];
        return newDrafts;
      });
    }

    try {
      // Save to database
      const res = await axios.post(`http://localhost:3000/api/chat/send`, {
        sender: user._id,
        receiver: selectedUser._id,
        message: messageText,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Create message data with database ID
      const messageData = {
        _id: res.data.chat._id,
        sender: user._id,
        receiver: selectedUser._id,
        message: messageText,
        timestamp: new Date().toISOString(),
        senderName: user.username,
        createdAt: res.data.chat.createdAt
      };

      // Add message to local chat history immediately (for sender)
      setChatHistory(prev => [...prev, messageData]);

      // Emit real-time message via Socket.IO (for receiver)
      if (socketRef.current) {
        socketRef.current.emit('send_message', messageData);
      }

      // Stop typing indicator
      if (socketRef.current) {
        socketRef.current.emit('typing', {
          userId: user._id,
          receiverId: selectedUser._id,
          isTyping: false
        });
      }

      // Refresh conversations to update last message
      fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore message in input if sending failed
      setMessage(messageText);
    }
  };

  // Handle typing indicator
  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (socketRef.current && selectedUser) {
      if (!isTyping) {
        setIsTyping(true);
        socketRef.current.emit('typing', {
          userId: user._id,
          receiverId: selectedUser._id,
          isTyping: true
        });
      }

      // Clear typing after 1 second of no typing
      clearTimeout(window.typingTimer);
      window.typingTimer = setTimeout(() => {
        setIsTyping(false);
        socketRef.current.emit('typing', {
          userId: user._id,
          receiverId: selectedUser._id,
          isTyping: false
        });
      }, 1000);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Helper function to generate user avatar
  const generateAvatar = (username) => {
    const initials = username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const colorIndex = username.charCodeAt(0) % colors.length;
    return { initials, color: colors[colorIndex] };
  };

  // Helper function to format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Helper function to truncate message
  const truncateMessage = (message, maxLength = 30) => {
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading user...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Enhanced Sidebar */}
      <div style={{
        width: '350px',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: generateAvatar(user?.username || 'User').color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              marginRight: '12px'
            }}>
              {generateAvatar(user?.username || 'User').initials}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
                {user?.username || 'Guest'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                {onlineUsers.includes(user?._id) ? '🟢 Online' : '⚫ Offline'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '80%',
                padding: '10px 40px 10px 15px',
                border: '1px solid #ddd',
                borderRadius: '20px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: '#f5f5f5'
              }}
            />
            <span style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999'
            }}>🔍</span>
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Recent Conversations */}
          {!showAllUsers && (
            <div>
              <div style={{
                padding: '15px 20px 10px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#666',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Recent Chats</span>
                <button
                  onClick={() => { fetchAllUsers(); setShowAllUsers(true); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#007bff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '5px 10px',
                    borderRadius: '15px',
                    backgroundColor: '#e3f2fd'
                  }}
                >
                  + New Chat
                </button>
              </div>

              {conversations.filter(conv =>
                conv.username.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((conv) => {
                const avatar = generateAvatar(conv.username);
                return (
                  <div
                    key={conv._id}
                    style={{
                      padding: '15px 20px',
                      backgroundColor: selectedUser?._id === conv._id ? '#e3f2fd' : 'white',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => fetchChatHistory(conv)}
                    onMouseEnter={(e) => {
                      if (selectedUser?._id !== conv._id) {
                        e.target.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedUser?._id !== conv._id) {
                        e.target.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ position: 'relative', marginRight: '12px' }}>
                      <div style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        backgroundColor: avatar.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {avatar.initials}
                      </div>
                      {onlineUsers.includes(conv._id) && (
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#4CAF50',
                          border: '2px solid white'
                        }} />
                      )}
                      {conv.unreadCount > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#ff4444',
                          color: 'white',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#333',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {conv.username}
                        </h4>
                        <span style={{
                          fontSize: '11px',
                          color: '#999',
                          flexShrink: 0,
                          marginLeft: '8px'
                        }}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: conv.unreadCount > 0 ? '#333' : '#666',
                        fontWeight: conv.unreadCount > 0 ? '500' : 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {conv.lastMessageSender === user._id ? 'You: ' : ''}
                        {truncateMessage(conv.lastMessage)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {conversations.length === 0 && (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>No conversations yet</h3>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    Click the "+ New Chat" button above to start your first conversation
                  </p>
                </div>
              )}
            </div>
          )}

          {/* All Users List */}
          {showAllUsers && (
            <div>
              <div style={{
                padding: '15px 20px 10px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#666',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>All Users</span>
                <button
                  onClick={() => setShowAllUsers(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#007bff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ← Back
                </button>
              </div>

              {allUsers.filter(u =>
                u.username.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((u) => {
                const avatar = generateAvatar(u.username);
                return (
                  <div
                    key={u._id}
                    style={{
                      padding: '15px 20px',
                      backgroundColor: selectedUser?._id === u._id ? '#e3f2fd' : 'white',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => { fetchChatHistory(u); setShowAllUsers(false); }}
                    onMouseEnter={(e) => {
                      if (selectedUser?._id !== u._id) {
                        e.target.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedUser?._id !== u._id) {
                        e.target.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ position: 'relative', marginRight: '12px' }}>
                      <div style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '50%',
                        backgroundColor: avatar.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {avatar.initials}
                      </div>
                      {onlineUsers.includes(u._id) && (
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#4CAF50',
                          border: '2px solid white'
                        }} />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#333'
                      }}>
                        {u.username}
                      </h4>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#666'
                      }}>
                        {onlineUsers.includes(u._id) ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ position: 'relative', marginRight: '15px' }}>
                <div style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  backgroundColor: generateAvatar(selectedUser.username).color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {generateAvatar(selectedUser.username).initials}
                </div>
                {onlineUsers.includes(selectedUser._id) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#4CAF50',
                    border: '2px solid white'
                  }} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
                  {selectedUser.username}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                  {onlineUsers.includes(selectedUser._id) ? 'Online' : 'Last seen recently'}
                  {typingUsers[selectedUser._id] && ' • typing...'}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              backgroundColor: '#f8f9fa'
            }}>
              {chatHistory.map((msg, index) => (
                <div
                  key={msg._id || index}
                  style={{
                    textAlign: msg.sender === user._id ? 'right' : 'left',
                    marginBottom: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-block',
                      maxWidth: '70%',
                      padding: '8px 12px',
                      borderRadius: '18px',
                      backgroundColor: msg.sender === user._id ? '#007bff' : '#e9ecef',
                      color: msg.sender === user._id ? 'white' : 'black',
                    }}
                  >
                    <p style={{ margin: 0, wordBreak: 'break-word' }}>
                      {msg.message}
                    </p>
                    <small
                      style={{
                        fontSize: '0.75rem',
                        opacity: 0.7,
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() :
                       msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                    </small>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {typingUsers[selectedUser?._id] && (
                <div style={{ textAlign: 'left', marginBottom: '10px' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: '18px',
                      backgroundColor: '#e9ecef',
                      fontStyle: 'italic',
                      color: '#666',
                    }}
                  >
                    {selectedUser.username} is typing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{ textAlign: 'center', color: '#666' }}>
              <h3>Welcome to Chat!</h3>
              <p>Select a conversation from the sidebar to start chatting</p>
            </div>
          </div>
        )}

        {selectedUser && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: 'white'
          }}>
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <input
                value={message}
                onChange={handleTyping}
                style={{
                  flex: 1,
                  padding: '15px 20px',
                  borderRadius: '25px',
                  border: '1px solid #ddd',
                  outline: 'none',
                  fontSize: '14px',
                  backgroundColor: '#f8f9fa',
                  transition: 'border-color 0.2s, background-color 0.2s'
                }}
                placeholder={`Type a message to ${selectedUser.username}...`}
                autoComplete="off"
                onFocus={(e) => {
                  e.target.style.borderColor = '#007bff';
                  e.target.style.backgroundColor = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ddd';
                  e.target.style.backgroundColor = '#f8f9fa';
                }}
              />
              <button
                type="submit"
                disabled={!message.trim()}
                style={{
                  padding: '15px 25px',
                  borderRadius: '25px',
                  border: 'none',
                  backgroundColor: message.trim() ? '#007bff' : '#ccc',
                  color: 'white',
                  cursor: message.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                  minWidth: '80px'
                }}
                onMouseEnter={(e) => {
                  if (message.trim()) {
                    e.target.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (message.trim()) {
                    e.target.style.backgroundColor = '#007bff';
                  }
                }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;