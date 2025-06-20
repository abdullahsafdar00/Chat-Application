const ChatModel = require('../models/chat.model');
const UserModel = require('../models/user.model');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @description    Send a message
// @route   POST /api/chat/send
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sender, receiver, message} = req.body;

    const newChat = await ChatModel.create({ sender, receiver, message });
await newChat.populate('sender', 'username');
res.status(201).json({ message: 'Message sent', chat: newChat });

  } catch (error) {
    res.status(500).json({ message: 'Message send failed', error });
  }
};

// @description    Get chat history between two users
// @route   GET /api/chat/history/:user1/:user2
// @access  Private
const getChatHistory = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const chatHistory = await ChatModel.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ createdAt: 1 })// oldest to newest
    .populate('sender', 'username')
.populate('receiver', 'username');

    res.status(200).json(chatHistory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch chat history', error });
  }
};

// @desc    Get all conversations of a user with last message
// @route   GET /api/chat/conversations/:userId
// @access  Private
const getAllConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Getting conversations for user:', userId);

    // Get all chats for the user
    const chats = await ChatModel.find({
      $or: [{ sender: userId }, { receiver: userId }]
    }).populate('sender', 'username email online')
      .populate('receiver', 'username email online')
      .sort({ createdAt: -1 });

    console.log('Found chats:', chats.length);

    // Group by conversation partner
    const conversationMap = new Map();

    chats.forEach(chat => {
      const partnerId = chat.sender._id.toString() === userId ?
        chat.receiver._id.toString() : chat.sender._id.toString();

      if (!conversationMap.has(partnerId)) {
        const partner = chat.sender._id.toString() === userId ? chat.receiver : chat.sender;
        conversationMap.set(partnerId, {
          _id: partner._id,
          username: partner.username,
          email: partner.email,
          online: partner.online,
          lastMessage: chat.message,
          lastMessageTime: chat.createdAt,
          lastMessageSender: chat.sender._id,
          unreadCount: 0 // We'll calculate this separately if needed
        });
      }
    });

    const conversations = Array.from(conversationMap.values());
    console.log('Processed conversations:', conversations.length);

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: 'Failed to get conversations', error: error.message });
  }
};

// @desc    Delete a message by ID
// @route   DELETE /api/chat/delete/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const deleted = await ChatModel.findByIdAndDelete(messageId);

    if (!deleted) return res.status(404).json({ message: 'Message not found' });

    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete message', error });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  getAllConversations,
  deleteMessage,
};
