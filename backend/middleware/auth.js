const jwt = require('jsonwebtoken');

const env = require('../config/env');
const Student = require('../models/Student');
const Counselor = require('../models/Counselor');
const Admin = require('../models/Admin');

const roleModelMap = {
  student: Student,
  counselor: Counselor,
  admin: Admin
};

async function protect(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' });
    }

    const decoded = jwt.verify(token, env.jwt.secret);
    const Model = roleModelMap[decoded.role];
    if (!Model) {
      return res.status(401).json({ message: 'Unknown account role' });
    }

    const user = await Model.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }

    req.user = {
      userId: user._id.toString(),
      role: decoded.role,
      profile: user
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid authentication token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}

module.exports = {
  protect,
  authorize
};
