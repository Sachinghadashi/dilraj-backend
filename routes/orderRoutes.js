const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderStatus,
  cancelOrder
} = require('../controllers/orderController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public vs Private routes differentiation
// All order actions require authentication.
router.use(protect); 

// Customer specific (Placing order, viewing their own list)
router.route('/')
  .post(authorize('customer', 'admin'), createOrder)
  .get(authorize('admin'), getOrders); // Admin view all

router.route('/myorders')
  .get(authorize('customer'), getMyOrders);

router.route('/:id')
  .get(authorize('customer', 'admin'), getOrderById);

router.route('/:id/cancel')
  .put(authorize('customer'), cancelOrder);

// Admin specific management routes
router.route('/:id/status')
  .put(authorize('admin'), updateOrderStatus);

module.exports = router;
