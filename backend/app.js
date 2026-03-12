const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const counselorRoutes = require('./routes/counselorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PFADS+',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/counselors', counselorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (path.extname(req.path)) {
    return res.status(404).json({ message: 'Asset not found' });
  }

  const target = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
  res.sendFile(path.join(frontendPath, target), (error) => {
    if (error) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
