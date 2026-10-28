import dns from 'node:dns/promises';

dns.setServers(['1.1.1.1', '8.8.8.8']);

import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { User, Vehicle } from './models.js';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('WARNING: Set JWT_SECRET to a random secret of at least 32 characters in .env');
}
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));
const messageLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

const io = new Server(server, { cors: { origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') } });
// Signaling only: no phone numbers are sent through public vehicle profiles.
io.on('connection', socket => {
  socket.on('owner:watch', async ({ vehicleId, token } = {}) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const vehicle = await Vehicle.findOne({ _id: vehicleId, owner: payload.sub, active: true }).select('_id');
      if (vehicle) socket.join(`vehicle:${vehicleId}`);
    } catch { socket.emit('app:error', { message: 'Owner authentication failed.' }); }
  });
  socket.on('call:request', async ({ vehicleId, offer, sessionId } = {}) => {
    if (!mongoose.isValidObjectId(vehicleId) || !offer || typeof sessionId !== 'string') return;
    const vehicle = await Vehicle.findOne({ _id: vehicleId, active: true }).select('_id');
    if (!vehicle) return socket.emit('call:unavailable', { sessionId });
    // Owner app must implement this event before calls can complete.
    io.to(`vehicle:${vehicleId}`).emit('call:incoming', { vehicleId, offer, sessionId });
  });
  socket.on('call:answer', ({ vehicleId, answer, sessionId } = {}) => {
    if (vehicleId && answer && sessionId) socket.to(`visitor:${sessionId}`).emit('call:answer', { answer, sessionId });
  });
  socket.on('call:visitor-join', ({ sessionId } = {}) => {
    if (typeof sessionId === 'string' && sessionId.length < 100) socket.join(`visitor:${sessionId}`);
  });
  socket.on('call:ice', ({ targetRoom, candidate } = {}) => {
    if (typeof targetRoom === 'string' && candidate) socket.to(targetRoom).emit('call:ice', { candidate });
  });
});

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in.' }); }
}
function cleanText(value, max = 100) { return String(value ?? '').trim().slice(0, max); }
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ParkSafe API' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Enter a name, valid email and password of at least 8 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: String(user._id), name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: 'Registration failed.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password.' });
  const token = jwt.sign({ sub: String(user._id) }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: String(user._id), name: user.name, email: user.email } });
});
app.get('/api/vehicles/mine', auth, async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.user.sub }).sort({ createdAt: -1 }).lean();
  res.json(vehicles.map(v => ({ id: String(v._id), make: v.make, model: v.model, color: v.color, registration: v.registration, active: v.active })));
});
app.post('/api/vehicles', auth, async (req, res) => {
  const make = cleanText(req.body.make, 50), model = cleanText(req.body.model, 50);
  const registration = cleanText(req.body.registration, 20).toUpperCase();
  if (!make || !model || !registration) return res.status(400).json({ error: 'Make, model and registration are required.' });
  const v = await Vehicle.create({ owner: req.user.sub, make, model, color: cleanText(req.body.color, 30), registration });
  res.status(201).json({ id: String(v._id), make: v.make, model: v.model, color: v.color, registration: v.registration, active: v.active });
});
app.patch('/api/vehicles/:id/active', auth, async (req, res) => {
  const v = await Vehicle.findOneAndUpdate({ _id: req.params.id, owner: req.user.sub }, { active: Boolean(req.body.active) }, { new: true });
  if (!v) return res.status(404).json({ error: 'Vehicle not found.' });
  res.json({ id: String(v._id), active: v.active });
});
app.get('/api/vehicles/:id/public', async (req, res) => {
  const v = await Vehicle.findOne({ _id: req.params.id, active: true }).populate('owner', 'name').lean();
  if (!v) return res.status(404).json({ error: 'Vehicle QR is invalid or inactive.' });
  // Privacy boundary: never return email, phone, password hash or owner ID here.
  res.json({ id: String(v._id), ownerName: v.owner.name, make: v.make, model: v.model, color: v.color, registration: v.registration });
});
app.post('/api/vehicles/:id/messages', messageLimiter, async (req, res) => {
  const v = await Vehicle.findOne({ _id: req.params.id, active: true }).select('_id owner');
  if (!v) return res.status(404).json({ error: 'Vehicle not found.' });
  const message = cleanText(req.body.message, 500);
  if (message.length < 2) return res.status(400).json({ error: 'Message is too short.' });
  // MVP: notify online owner sessions. Persistent message inbox is a later phase.
  io.to(`vehicle:${String(v._id)}`).emit('message:incoming', { vehicleId: String(v._id), message, createdAt: new Date().toISOString() });
  res.status(202).json({ ok: true, message: 'Message submitted. Owner receives it while online.' });
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Unexpected server error.' }); });
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/parksafe');
  server.listen(PORT, () => console.log(`ParkSafe API listening on http://localhost:${PORT}`));
} catch (e) {
  console.error('MongoDB connection failed. Check MONGODB_URI in .env.', e.message);
  process.exit(1);
}
