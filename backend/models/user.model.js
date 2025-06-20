const mongoose = require(`mongoose`);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true, minlength: 13},
  password: { type: String, required: true, minlength: 8 },
  online:   { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;