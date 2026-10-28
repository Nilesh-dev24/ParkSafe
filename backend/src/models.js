import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const vehicleSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  make: { type: String, required: true, trim: true, maxlength: 50 },
  model: { type: String, required: true, trim: true, maxlength: 50 },
  color: { type: String, default: '', trim: true, maxlength: 30 },
  registration: { type: String, required: true, trim: true, maxlength: 20 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
