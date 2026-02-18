import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './modules/users/user.model.js';
import { hashPassword } from './utils/password.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiqda';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: 'admin@aiqda.com' });
  if (existing) {
    console.log('Admin account already exists');
  } else {
    const hashedPassword = await hashPassword('admin123');
    await User.create({
      email: 'admin@aiqda.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'admin'
    });
    console.log('Admin account created: admin@aiqda.com / admin123');
  }

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
