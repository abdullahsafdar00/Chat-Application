const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UserModel = require('../models/user.model');

// Register Controller
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  console.log("🔥 Incoming Resgister Request:", req.body);
  try {
    const userExists = await UserModel.findOne({ email });

    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserModel.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ user: { username, email }, token });
  } catch (error) {
    res.status(500).json({ message: 'Cannot register user', error });
  }
};

// Login Controller

const loginUser = async (req, res) => {
  const { email, password  } = req.body;
  console.log("🔥 Incoming Login Request:", req.body);

  try {
   const user = await UserModel.findOne({ email });
if (!user) return res.status(400).json({ message: 'Invalid credentials' });

const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
  httpOnly: false,
  secure: false, 
  sameSite: 'Lax',
  maxAge: 24 * 60 * 60 * 1000, // 1 day
});

    res.status(200).json({
  user: { username: user.username, email: user.email, _id: user._id },
  token
});

  } catch (error) {
    res.status(500).json({ message: 'Cannot login user', error });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
