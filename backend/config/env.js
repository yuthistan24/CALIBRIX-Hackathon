const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pfadsplus',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001',
  translationApiUrl: process.env.TRANSLATION_API_URL || '',
  llm: {
    provider: process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'ollama'),
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2'
  },
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
