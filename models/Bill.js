const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName: {
          type: String,
          required: true,
        },
        barcode: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    subTotal: {
      type: Number,
      required: true,
      default: 0.0,
    },
    tax: {
      type: Number,
      required: true,
      default: 0.0, // GST amount
    },
    discount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Cash', 'UPI', 'Card'],
      default: 'Cash',
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerPhone: {
      type: String, // Optional field to send SMS/WhatsApp
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt (date)
  }
);

module.exports = mongoose.model('Bill', billSchema);
