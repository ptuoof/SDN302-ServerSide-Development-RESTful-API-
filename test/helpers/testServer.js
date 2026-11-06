// Starts the API on a random port against a throw-away database:
//  - TEST_MONGO_URI set   -> that database (it is DROPPED at the end, never point it at real data)
//  - otherwise            -> an in-memory MongoDB (mongodb-memory-server, downloaded on first run)
// Then runs migrations + seed, so tests can sign in as admin@cookflow.demo / Admin123!.
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_only_secret_do_not_use_in_production_0123456789';

async function startTestServer() {
  let memoryServer = null;
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('cookflow_test');
  }

  await mongoose.connect(uri);
  const { runMigrations } = require('../../utils/migrations');
  const { seedDatabase } = require('../../seed/seedData');
  await runMigrations();
  await seedDatabase({ quiet: true });

  const app = require('../../server');
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const stop = async () => {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
  };

  return { baseUrl, stop };
}

/** JSON request helper: request(path, method, body, token) -> { status, data } */
const makeRequest = baseUrl => async (path, method = 'GET', body = null, token = null) => {
  const headers = {};
  if (body !== null && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${encodeURI(path)}`, {
    method,
    headers,
    body: body === null ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
};

module.exports = { startTestServer, makeRequest };
