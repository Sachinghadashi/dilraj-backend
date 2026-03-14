const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
    },
    barcode: {
      type: String,
      required: [true, 'Please add a barcode'],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please add a selling price'],
      min: 0,
    },
    mrp: {
      type: Number,
      required: [true, 'Please add the MRP (Maximum Retail Price)'],
      min: 0,
    },
    stock: {
      type: Number,
      required: [true, 'Please add stock quantity'],
      min: 0,
      default: 0,
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: [
        'Groceries',
        'Beverages',
        'Personal Care',
        'Household',
        'Snacks',
        'Dairy',
        'Other'
      ],
      default: 'Other',
    },
    image: {
      type: String,
      default: 'no-photo.jpg', 
    },
    description: {
      type: String,
      default: 'No description provided.',
      maxlength: [500, 'Description can not be more than 500 characters'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('Product', productSchema);
