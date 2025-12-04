require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crackthemyth';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_change_me';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error', err);
});

const UserSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  achievements: { type: Object, default: { stars: {}, medals: {} } },
  stats: { type: Object, default: { totalTime: 0, totalAttempts: 0, quizzesCompleted: 0 } },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Optional content collections so quizzes/books can be stored in DB
const QuizSchema = new mongoose.Schema({ id: String, title: String, levels: mongoose.Schema.Types.Mixed }, { strict: false });
const BookSchema = new mongoose.Schema({ id: String, title: String, content: String, reference: String }, { strict: false });
const Quiz = mongoose.model('Quiz', QuizSchema);
const Book = mongoose.model('Book', BookSchema);

// Simple sample content (small) returned if DB collections empty
const sampleQuizzes = [
  { id: 'QZ1', title: 'Sample Quiz', levels: [ { id: 'QZ1-E', title: 'Easy', questions: [ { q: 'Is sky blue?', a: 'Yes', options: ['Yes','No'], explanation: 'Typically yes.' } ] } ] }
];
const sampleBooks = [ { id: 'B1', title: 'Sample Module', content: 'This is a sample module stored on the server.', reference: 'Local' } ];

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash: hash });
    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    const userObj = { _id: user._id, name: user.name, email: user.email, achievements: user.achievements, stats: user.stats };
    return res.json({ token, user: userObj });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    const userObj = { _id: user._id, name: user.name, email: user.email, achievements: user.achievements, stats: user.stats };
    return res.json({ token, user: userObj });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Content endpoints
app.get('/api/content/quizzes', async (req, res) => {
  try {
    // Try DB first
    const docs = await Quiz.find().lean().exec();
    if (docs && docs.length > 0) return res.json({ quizzes: docs });
    // fallback sample
    return res.json({ quizzes: sampleQuizzes });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/content/books', async (req, res) => {
  try {
    const docs = await Book.find().lean().exec();
    if (docs && docs.length > 0) return res.json({ books: docs });
    return res.json({ books: sampleBooks });
  } catch (e) { return res.status(500).json({ message: 'Server error' }); }
});

// Middleware to protect routes
const authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Invalid token' });
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) { return res.status(401).json({ message: 'Invalid token' }); }
};

app.get('/api/users/:id/achievements', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    if (req.userId.toString() !== id.toString()) return res.status(403).json({ message: 'Forbidden' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    return res.json({ achievements: user.achievements });
  } catch (e) { return res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/users/:id/achievements', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    if (req.userId.toString() !== id.toString()) return res.status(403).json({ message: 'Forbidden' });
    const { stars, medals } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    user.achievements = { stars: stars || user.achievements.stars, medals: medals || user.achievements.medals };
    await user.save();
    return res.json({ achievements: user.achievements });
  } catch (e) { console.error(e); return res.status(500).json({ message: 'Server error' }); }
});

app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
