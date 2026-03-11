const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pfadsplus',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  admin: {
    name: process.env.ADMIN_NAME || 'PFADS Admin',
    email: process.env.ADMIN_EMAIL || 'admin@pfadsplus.local',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345'
  },
  demoCounselorPassword: process.env.DEMO_COUNSELOR_PASSWORD || 'Counselor@123'
};
