const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(" No token header");
      return res.status(401).json({ message: 'No token provided' });
    }

    const token   = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) 
    console.log("User not found");
    return res.status(401).json({ message: 'User not found' });
    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.message);
    return res.status(401).json({ message: err.message });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Role '${req.user.role}' not allowed` });
    }
    next();
  };
};

module.exports = { protect, authorize };