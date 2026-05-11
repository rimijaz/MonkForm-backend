const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/form-builder';

async function checkAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ email: 'admin123@gmail.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found in database');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('📧 Email:', adminUser.email);
    console.log('👤 Name:', adminUser.firstName, adminUser.lastName);
    console.log('🔑 Role:', adminUser.role);
    console.log('✅ Active:', adminUser.isActive);
    console.log('📅 Created:', adminUser.createdAt);
    
    // Test password comparison
    console.log('\n🔍 Testing password comparison...');
    const isPasswordValid = await adminUser.comparePassword('admin123');
    console.log('🔑 Password "admin123" is valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Password comparison failed. Recreating admin user...');
      
      // Delete the existing user
      await User.deleteOne({ email: 'admin123@gmail.com' });
      
      // Create new admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const newAdmin = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin123@gmail.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      
      await newAdmin.save();
      console.log('✅ Admin user recreated successfully!');
      
      // Test again
      const testUser = await User.findOne({ email: 'admin123@gmail.com' });
      const isValidNow = await testUser.comparePassword('admin123');
      console.log('🔑 New password is valid:', isValidNow);
    }

  } catch (error) {
    console.error('❌ Error checking admin user:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
checkAdminUser();
