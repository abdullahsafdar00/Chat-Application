const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const verifyToken = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validation.middleware');

const {
  sendMessage,
  getChatHistory,
  getAllConversations,
  deleteMessage,
} = require('../controllers/chat.controller');


router.post('/send', verifyToken, [
  body('sender').notEmpty().withMessage('Sender ID is required'),
  body('receiver').notEmpty().withMessage('Receiver ID is required'),
  body('message').notEmpty().withMessage('Message is required')
], validate, sendMessage);

router.get(
  '/history/:user1/:user2',
  verifyToken,
  [
    param('user1').notEmpty().withMessage('User1 ID is required'),
    param('user2').notEmpty().withMessage('User2 ID is required'),
  ],
  validate,
  getChatHistory
);

router.get(
  '/conversations/:userId',
  verifyToken,
  [param('userId').notEmpty().withMessage('User ID is required')],
  validate,
  getAllConversations
);

router.delete(
  '/delete/:messageId',
  verifyToken,
  [param('messageId').notEmpty().withMessage('Message ID is required')],
  validate,
  deleteMessage
);

module.exports = router;
