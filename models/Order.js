const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    deliveryAddress: {
      addressLine1: { type: String, required: true },
      area: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      contactNumber: { type: String, required: true },
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    deliveryFee: {
      type: Number,
      default: 0.0,
    },
    handlingFee: {
      type: Number,
      default: 0.0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Cash On Delivery', 'Online Payment'],
      default: 'Cash On Delivery',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending',
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ['Placed', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Placed',
    },
    deliveryDate: {
      type: Date,
    },
  },
  {
    timestamps: true, // manages createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('Order', orderSchema);
