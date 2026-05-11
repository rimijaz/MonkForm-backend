const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔍 Auth - Decoded token:', decoded);
    
    const user = await User.findById(decoded.userId).select('-password');
    console.log('🔍 Auth - Found user:', !!user);
    if (user) {
      console.log('👤 Auth - User details:', { id: user._id, email: user.email, role: user.role, isActive: user.isActive });
    }
    
    if (!user || !user.isActive) {
      console.log('❌ Auth - User not found or inactive');
      return res.status(401).json({ message: 'Invalid token or user not active' });
    }

    req.user = user;
    console.log('✅ Auth - Authentication successful');
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};

// Role-based authorization middleware
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    
    if (!req.user) {
      console.log('❌ AuthZ - No user found');
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      console.log('❌ AuthZ - Insufficient permissions');
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions' 
      });
    }

    console.log('✅ AuthZ - Authorization successful');
    next();
  };
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  generateToken,
  JWT_SECRET
};
