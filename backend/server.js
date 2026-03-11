const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = require('./app');
const { connectDatabase } = require('./config/db');
const env = require('./config/env');
const { configureSocketServer } = require('./config/socket');
const Admin = require('./models/Admin');
const Counselor = require('./models/Counselor');
const demoCounselors = require('./data/demoCounselors');

async function seedAdmin() {
  const existingAdmin = await Admin.findOne({ email: env.admin.email });
  if (existingAdmin) {
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(env.admin.password, 10);
  return Admin.create({
    name: env.admin.name,
    email: env.admin.email,
    passwordHash
  });
}

async function seedDemoCounselors() {
  const counselorCount = await Counselor.countDocuments();
  if (counselorCount > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(env.demoCounselorPassword, 10);
  await Counselor.insertMany(
    demoCounselors.map((counselor) => ({
      ...counselor,
      passwordHash,
      workloadCapacity: 8,
      activeSessions: 0
    }))
  );
}

async function startServer() {
  await connectDatabase();
  await seedAdmin();
  await seedDemoCounselors();

  const server = http.createServer(app);
  const io = configureSocketServer(server, jwt, env.jwt.secret);
  app.set('io', io);

  const preferredPort = env.port;
  const maxAttempts = 10;
  let port = preferredPort;

  while (port < preferredPort + maxAttempts + 1) {
    try {
      await new Promise((resolve, reject) => {
        const handleError = (error) => {
          server.off('listening', handleListening);
          reject(error);
        };
        const handleListening = () => {
          server.off('error', handleError);
          resolve();
        };

        server.once('error', handleError);
        server.once('listening', handleListening);
        server.listen(port);
      });

      process.stdout.write(`PFADS+ listening on http://localhost:${port}\n`);
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') {
        throw error;
      }

      port += 1;
      process.stdout.write(
        `Port ${port - 1} is busy. Retrying PFADS+ on http://localhost:${port}\n`
      );
    }
  }

  throw new Error(`Unable to find a free port between ${preferredPort} and ${port - 1}`);
}

startServer().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
