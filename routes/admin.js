const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all users (admin only)
router.get('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    console.log('🔍 Admin API - Get all users called');
    console.log('👤 Authenticated user:', req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : 'No user');
    console.log('🔐 User role check:', req.user.role === 'admin' ? 'Admin' : 'Not admin');
    const users = await User.find({})
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 });
    
    // Add forms count for each user
    const usersWithFormsCount = await Promise.all(
      users.map(async (user) => {
        const formsCount = await Form.countDocuments({ createdBy: user._id });
        return {
          ...user.toObject(),
          formsCount
        };
      })
    );
    
    res.json(usersWithFormsCount);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get forms by user (admin only)
router.get('/users/:userId/forms', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user's forms
    const forms = await Form.find({ createdBy: userId })
      .sort({ createdAt: -1 });
    
    res.json(forms);
  } catch (error) {
    console.error('Error fetching user forms:', error);
    res.status(500).json({ message: 'Failed to fetch user forms' });
  }
});

// Get all forms (admin only)
router.get('/forms', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    console.log('🔍 Admin API - Get all forms called');
    console.log('👤 Authenticated user:', req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : 'No user');
    
    const forms = await Form.find({})
      .sort({ createdAt: -1 });
    
    console.log('📋 Admin API - Forms found:', forms.length);
    
    res.json(forms);
  } catch (error) {
    console.error('Error fetching all forms:', error);
    res.status(500).json({ message: 'Failed to fetch forms' });
  }
});

// Get responses (admin only)
router.get('/responses', authenticateToken, authorizeRoles(['admin', 'user']), async (req, res) => {
  try {

    let query = {};
    if (req.query.formId) {
      console.log('🔍 Filtering responses for specific form:', req.query.formId);
      query = { formId: req.query.formId };
    } else {
      console.log('🔍 Getting all responses from all forms');
      query = {};
    }
    
    // Get form responses from FormResponse collection
    const allFormResponses = await FormResponse.find(query)
      .sort({ submittedAt: -1 });
    
    console.log('📋 Admin API - Total responses found:', allFormResponses.length);
    
    // Get all forms to map titles
    const allForms = await Form.find({}).select('title');
    const formMap = {};
    allForms.forEach(form => {
      formMap[form._id] = form.title;
    });
    
    // Format responses with form titles
    const allResponses = allFormResponses.map(response => {
      console.log('Processing response:', response._id);
      return {
        _id: response._id,
        answers: response.answers,
        submittedAt: response.submittedAt,
        ipAddress: response.ipAddress,
        userAgent: response.userAgent,
        respondentId: response.respondentId,
        respondentEmail: response.respondentEmail,
        formId: response.formId,
        formTitle: formMap[response.formId] || 'Unknown Form'
      };
    });
    
    console.log('📊 Admin API - Formatted responses:', allResponses.length);
    
    res.json(allResponses);
  } catch (error) {
    console.error('Error fetching all responses:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to fetch responses', error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    // Find user to delete
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deletion of other admins
    if (user.role === 'admin' && userId !== req.user.id) {
      return res.status(400).json({ message: 'Cannot delete admin users' });
    }
    
    // Delete all forms created by this user
    await Form.deleteMany({ createdBy: userId });
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    res.json({ message: 'User and their forms deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;
