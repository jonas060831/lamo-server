import mongoose from 'mongoose';

const PORT = process.env.PORT || 9000

mongoose.connection.once('connected', () => {
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    // 1 = connected, 2 = connecting
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI!);

  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
};
