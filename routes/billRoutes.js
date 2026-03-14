const express = require('express');
const {
  createBill,
  getBills,
  getBillById,
} = require('../controllers/billController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Both Admin and Cashier can generate bills and view bills
router.route('/')
  .post(protect, authorize('admin', 'cashier'), createBill)
  .get(protect, authorize('admin', 'cashier'), getBills);

router.route('/:id')
  .get(protect, authorize('admin', 'cashier'), getBillById);

module.exports = router;
