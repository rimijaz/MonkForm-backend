const express = require('express');
const router = express.Router();
const {
  createForm,
  getForms,
  getFormById,
  submitResponse,
  getFormResponses,
  evaluateVisibility,
  updateForm,
  deleteForm
} = require('../controllers/formController');
const { authenticateToken } = require('../middleware/auth');

// POST create new form (protected)
router.post('/', authenticateToken, createForm);

// GET all forms (protected - only user's forms)
router.get('/', authenticateToken, getForms);

// GET form by ID (public - for form submission)
router.get('/:id', getFormById);

// POST submit form response (public)
router.post('/submit', submitResponse);

// POST evaluate form visibility (public - for real-time form interaction)
router.post('/:id/evaluateVisibility', evaluateVisibility);

// GET form responses (protected - only form owner)
router.get('/:id/responses', authenticateToken, getFormResponses);

// PUT update form (protected - only form owner)
router.put('/:id', authenticateToken, updateForm);

// DELETE form (protected - only form owner)
router.delete('/:id', authenticateToken, deleteForm);

module.exports = router;
