const mongoose = require('mongoose');

const rankedFactorSchema = new mongoose.Schema(
  {
    factor: { type: String, required: true },
    score: { type: Number, required: true }
  },
  { _id: false }
);

const clusterResultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    pfadsScore: { type: mongoose.Schema.Types.ObjectId, ref: 'PfadsScore', required: true },
    clusterId: { type: Number, required: true },
    clusterLabel: { type: String, required: true },
    dominantFactor: { type: String, required: true },
    rankedFactors: { type: [rankedFactorSchema], default: [] },
    centroidDistances: { type: [Number], default: [] }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ClusterResult', clusterResultSchema, 'cluster_results');
