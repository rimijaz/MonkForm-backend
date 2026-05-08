const mongoose = require('mongoose');

// Answer sub-document schema for individual field responses
const answerSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
    // For repeatable groups, this will be an array of objects
    // Example: [{ degree: "BS", university: "FAST" }, { degree: "MS", university: "NUST" }]
  }
}, { _id: false });

// Main Form Response schema
const formResponseSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
    index: true // Critical for performance when querying responses by form
  },
  answers: [answerSchema],
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true // For sorting by submission date
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  // Optional: Track which user submitted (if authenticated)
  respondentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Optional: Email for respondent tracking
  respondentEmail: {
    type: String,
    trim: true,
    lowercase: true
  }
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
formResponseSchema.index({ formId: 1, submittedAt: -1 });

// Virtual for getting form data (populated)
formResponseSchema.virtual('formData', {
  ref: 'Form',
  localField: 'formId',
  foreignField: '_id',
  justOne: true
});

// Static method to get response statistics
formResponseSchema.statics.getStats = async function(formId) {
  const stats = await this.aggregate([
    { $match: { formId: mongoose.Types.ObjectId(formId) } },
    {
      $group: {
        _id: '$formId',
        totalResponses: { $sum: 1 },
        averageResponseTime: {
          $avg: {
            $dateDiff: {
              startDate: '$createdAt',
              endDate: '$submittedAt',
              unit: 'millisecond'
            }
          }
        },
        lastSubmission: { $max: '$submittedAt' }
      }
    }
  ]);
  
  return stats[0] || {
    totalResponses: 0,
    averageResponseTime: 0,
    lastSubmission: null
  };
};

// Static method to get responses with pagination
formResponseSchema.statics.getPaginatedResponses = async function(formId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const [responses, total] = await Promise.all([
    this.find({ formId })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('formData', 'title description')
      .lean(),
    this.countDocuments({ formId })
  ]);
  
  return {
    responses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

module.exports = mongoose.model('FormResponse', formResponseSchema);
