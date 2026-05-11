const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection - Same as server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rimijaz88_db_user:qDWbbWI7SPvv5N5W@cluster0.harda6o.mongodb.net/WebForm?appName=Cluster0';

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin user if exists
    const existingAdmin = await User.findOne({ email: 'admin123@gmail.com' });
    if (existingAdmin) {
      console.log('Deleting existing admin user...');
      await User.deleteOne({ email: 'admin123@gmail.com' });
    }

    // Create admin user (password will be hashed automatically by pre-save hook)
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin123@gmail.com',
      password: 'admin123', // Plain text - will be hashed by pre-save hook
      role: 'admin',
      isActive: true
    });

    // Save admin user
    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin123@gmail.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role: admin');
    console.log('✅ Status: Active');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
createAdminUser();
