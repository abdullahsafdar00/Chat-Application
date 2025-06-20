const express = require('express');
const router = express.Router();
const {body} = require('express-validator');
const validate = require('../middlewares/validation.middleware');
const { registerUser, loginUser } = require('../controllers/user.controller');

router.post('/register', [
    body(`username`).trim().notEmpty().withMessage(`Username is required`),
    body(`email`).trim().notEmpty().withMessage(`Email is required`).isEmail().withMessage(`Valid email is required`).normalizeEmail(),
    body(`password`).trim().notEmpty().isStrongPassword().withMessage(`Password must be at least 8 characters`)
], validate, registerUser);


router.post('/login', [
    body("email").trim().notEmpty().withMessage("Email is required").isEmail().withMessage("Valid email is required"),
    body("password").trim().notEmpty().withMessage("Password is required")
], validate, loginUser);


module.exports = router;