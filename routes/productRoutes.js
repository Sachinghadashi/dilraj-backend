const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// Import authentication and authorization middleware
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (Admins, Cashiers, Customers)
router.route('/')
  .get(getProducts)
  // Protect route and ONLY allow admins to create products
  .post(protect, authorize('admin'), createProduct);

router.route('/:id')
  .get(getProduct)
  // Protect routes and ONLY allow admins to update or delete
  .put(protect, authorize('admin'), updateProduct)
  .delete(protect, authorize('admin'), deleteProduct);

module.exports = router;
