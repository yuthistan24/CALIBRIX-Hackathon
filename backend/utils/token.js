const jwt = require('jsonwebtoken');

const env = require('../config/env');

function createToken(userId, role) {
  return jwt.sign({ userId, role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });
}

module.exports = {
  createToken
};
