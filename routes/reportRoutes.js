const express = require('express');
const {
  getDashboardSummary,
  getSalesTrend,
  getCashierPerformance,
  getTopProducts
} = require('../controllers/reportController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply middleware to all routes in this file (Only Admin can see reports)
router.use(protect);
router.use(authorize('admin'));

router.get('/summary', getDashboardSummary);
router.get('/sales-trend', getSalesTrend);
router.get('/cashier-performance', getCashierPerformance);
router.get('/top-products', getTopProducts);

module.exports = router;
