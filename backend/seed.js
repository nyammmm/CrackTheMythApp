require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crackthemyth';

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB for seeding at', MONGO_URI);

  // Schemas used by server
  const QuizSchema = new mongoose.Schema({}, { strict: false });
  const BookSchema = new mongoose.Schema({}, { strict: false });
  const Quiz = mongoose.model('Quiz', QuizSchema);
  const Book = mongoose.model('Book', BookSchema);

  // Prefer an automatically generated full seed file if present.
  const fullSeedPath = path.join(__dirname, 'seed_data_full.json');
  const seedPath = fs.existsSync(fullSeedPath)
    ? fullSeedPath
    : path.join(__dirname, 'seed_data.json');
  if (!fs.existsSync(seedPath)) {
    console.error('No seed file found in backend/. Create `seed_data.json` or run the extractor to make `seed_data_full.json`.');
    process.exit(1);
  }

  const raw = fs.readFileSync(seedPath, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('Invalid JSON in seed_data.json'); process.exit(1); }

  if (Array.isArray(data.quizzes) && data.quizzes.length) {
    console.log('Seeding quizzes: clearing collection...');
    await Quiz.deleteMany({});
    // Remove any provided `_id` fields that are non-ObjectId strings so
    // Mongo/Mongoose can assign proper ObjectIds. This avoids errors when
    // seed data used string IDs like "QZ1".
    const toInsert = data.quizzes.map(q => {
      const copy = Object.assign({}, q);
      if (copy._id && typeof copy._id === 'string') delete copy._id;
      // Some seed files use `id` (string) — remove it to avoid confusion
      // with Mongoose/MongoDB `_id` casting.
      if (copy.id && typeof copy.id === 'string') delete copy.id;
      return copy;
    });
    await Quiz.insertMany(toInsert);
    console.log('Inserted', toInsert.length, 'quizzes');
  } else {
    console.log('No quizzes found in seed file');
  }

  if (Array.isArray(data.books) && data.books.length) {
    console.log('Seeding books: clearing collection...');
    await Book.deleteMany({});
    const toInsertBooks = data.books.map(b => {
      const copy = Object.assign({}, b);
      if (copy._id && typeof copy._id === 'string') delete copy._id;
      if (copy.id && typeof copy.id === 'string') delete copy.id;
      return copy;
    });
    await Book.insertMany(toInsertBooks);
    console.log('Inserted', toInsertBooks.length, 'books');
  } else {
    console.log('No books found in seed file');
  }

  console.log('Seeding complete.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
