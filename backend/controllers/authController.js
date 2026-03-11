const bcrypt = require('bcryptjs');

const asyncHandler = require('../utils/asyncHandler');
const Student = require('../models/Student');
const Counselor = require('../models/Counselor');
const Admin = require('../models/Admin');
const { createToken } = require('../utils/token');

function sanitizeUser(user, role) {
  const payload = user.toObject ? user.toObject() : user;
  delete payload.passwordHash;
  return {
    ...payload,
    role
  };
}

async function createAccount({ Model, body, mapBodyToDocument, role, redirectTo }) {
  const existing = await Model.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const document = await Model.create(mapBodyToDocument(passwordHash));
  const token = createToken(document._id.toString(), role);

  return {
    token,
    redirectTo,
    user: sanitizeUser(document, role)
  };
}

async function login({ Model, email, password, role, redirectTo }) {
  const user = await Model.findOne({ email: email.toLowerCase() });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  return {
    token: createToken(user._id.toString(), role),
    redirectTo,
    user: sanitizeUser(user, role)
  };
}

const registerStudent = asyncHandler(async (req, res) => {
  const result = await createAccount({
    Model: Student,
    body: req.body,
    role: 'student',
    redirectTo: '/assessment.html',
    mapBodyToDocument: (passwordHash) => ({
      fullName: req.body.fullName,
      age: Number(req.body.age),
      gender: req.body.gender,
      district: req.body.district,
      address: req.body.address,
      mobileNumber: req.body.mobileNumber,
      email: req.body.email,
      passwordHash
    })
  });

  res.status(201).json(result);
});

const loginStudent = asyncHandler(async (req, res) => {
  const result = await login({
    Model: Student,
    email: req.body.email,
    password: req.body.password,
    role: 'student',
    redirectTo: '/dashboard.html'
  });
  res.json(result);
});

const registerCounselor = asyncHandler(async (req, res) => {
  const specialization = Array.isArray(req.body.specialization)
    ? req.body.specialization
    : String(req.body.specialization || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  const result = await createAccount({
    Model: Counselor,
    body: req.body,
    role: 'counselor',
    redirectTo: '/counselor-dashboard.html',
    mapBodyToDocument: (passwordHash) => ({
      name: req.body.name,
      qualification: req.body.qualification,
      specialization,
      experience: Number(req.body.experience),
      hospitalOrClinic: req.body.hospitalOrClinic,
      district: req.body.district,
      mobileNumber: req.body.mobileNumber,
      email: req.body.email,
      passwordHash,
      workloadCapacity: Number(req.body.workloadCapacity || 8)
    })
  });

  res.status(201).json(result);
});

const loginCounselor = asyncHandler(async (req, res) => {
  const result = await login({
    Model: Counselor,
    email: req.body.email,
    password: req.body.password,
    role: 'counselor',
    redirectTo: '/counselor-dashboard.html'
  });
  res.json(result);
});

const loginAdmin = asyncHandler(async (req, res) => {
  const result = await login({
    Model: Admin,
    email: req.body.email,
    password: req.body.password,
    role: 'admin',
    redirectTo: '/admin-dashboard.html'
  });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  res.json({
    user: sanitizeUser(req.user.profile, req.user.role)
  });
});

module.exports = {
  registerStudent,
  loginStudent,
  registerCounselor,
  loginCounselor,
  loginAdmin,
  me
};
