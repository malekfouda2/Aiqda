import 'dotenv/config';
import mongoose from 'mongoose';
import { seedConsultationsIfEmpty } from '../seed.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  await seedConsultationsIfEmpty();
  await mongoose.disconnect();
  console.log('Consultation seed complete');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
