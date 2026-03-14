const Bill = require('../models/Bill');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// @desc    Get dashboard summary (Total Revenue, Total Bills, Today's Sales)
// @route   GET /api/reports/summary
// @access  Private (Admin only)
exports.getDashboardSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total lifetime revenue and total bills (POS)
    const totalStats = await Bill.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBills: { $sum: 1 },
        },
      },
    ]);

    // 1b. Total lifetime revenue and orders (E-commerce Delivered)
    const totalOrderStats = await Order.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          totalBills: { $sum: 1 },
        },
      },
    ]);

    // 2. Today's revenue and bills (POS)
    const todayStats = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$totalAmount' },
          todayBills: { $sum: 1 },
        },
      },
    ]);

    // 2b. Today's revenue and orders (E-commerce Delivered today)
    const todayOrderStats = await Order.aggregate([
      {
        $match: {
          orderStatus: 'Delivered',
          deliveryDate: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$totalPrice' },
          todayBills: { $sum: 1 },
        },
      },
    ]);

    const posTotalRevenue = totalStats.length > 0 ? totalStats[0].totalRevenue : 0;
    const posTotalBills = totalStats.length > 0 ? totalStats[0].totalBills : 0;
    const posTodayRevenue = todayStats.length > 0 ? todayStats[0].todayRevenue : 0;
    const posTodayBills = todayStats.length > 0 ? todayStats[0].todayBills : 0;

    const ecomTotalRevenue = totalOrderStats.length > 0 ? totalOrderStats[0].totalRevenue : 0;
    const ecomTotalBills = totalOrderStats.length > 0 ? totalOrderStats[0].totalBills : 0;
    const ecomTodayRevenue = todayOrderStats.length > 0 ? todayOrderStats[0].todayRevenue : 0;
    const ecomTodayBills = todayOrderStats.length > 0 ? todayOrderStats[0].todayBills : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: posTotalRevenue + ecomTotalRevenue,
        totalBills: posTotalBills + ecomTotalBills,
        todayRevenue: posTodayRevenue + ecomTodayRevenue,
        todayBills: posTodayBills + ecomTodayBills,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating summary report' });
  }
};

// @desc    Get sales by date range (Daily/Monthly chart data)
// @route   GET /api/reports/sales-trend
// @access  Private (Admin only)
exports.getSalesTrend = async (req, res) => {
  try {
    // Generate the last 30 days trend by default
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const posSalesTrend = await Bill.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          dailyRevenue: { $sum: '$totalAmount' },
          billsCount: { $sum: 1 },
        },
      }
    ]);

    const ecomSalesTrend = await Order.aggregate([
      { $match: { orderStatus: 'Delivered', deliveryDate: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveryDate' } },
          dailyRevenue: { $sum: '$totalPrice' },
          billsCount: { $sum: 1 },
        },
      }
    ]);

    // Merge POS + Ecom trends by date
    const mergedTrendMap = new Map();
    [...posSalesTrend, ...ecomSalesTrend].forEach(stat => {
        if (!mergedTrendMap.has(stat._id)) {
            mergedTrendMap.set(stat._id, { _id: stat._id, dailyRevenue: 0, billsCount: 0 });
        }
        const existing = mergedTrendMap.get(stat._id);
        existing.dailyRevenue += stat.dailyRevenue;
        existing.billsCount += stat.billsCount;
    });

    const finalSalesTrend = Array.from(mergedTrendMap.values()).sort((a, b) => a._id.localeCompare(b._id));

    res.status(200).json({ success: true, data: finalSalesTrend });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating sales trend' });
  }
};

// @desc    Get cashier performance report
// @route   GET /api/reports/cashier-performance
// @access  Private (Admin only)
exports.getCashierPerformance = async (req, res) => {
  try {
    const cashierStats = await Bill.aggregate([
      {
        $group: {
          _id: '$cashierId',
          totalRevenueGenerated: { $sum: '$totalAmount' },
          totalBillsProcessed: { $sum: 1 },
        },
      },
      {
        // Populate the cashier details (name, email) from Users collection
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'cashierInfo',
        },
      },
      {
        $unwind: '$cashierInfo',
      },
      {
        $project: {
          _id: 1,
          totalRevenueGenerated: 1,
          totalBillsProcessed: 1,
          cashierName: '$cashierInfo.name',
          cashierEmail: '$cashierInfo.email',
          role: '$cashierInfo.role',
        },
      },
      {
        $sort: { totalRevenueGenerated: -1 }, // Sort by highest revenue
      },
    ]);

    res.status(200).json({ success: true, data: cashierStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating cashier performance report' });
  }
};

// @desc    Get top selling products
// @route   GET /api/reports/top-products
// @access  Private (Admin only)
exports.getTopProducts = async (req, res) => {
  try {
    const posTopProducts = await Bill.aggregate([
      { $unwind: '$products' }, 
      {
        $group: {
          _id: '$products.product', 
          productName: { $first: '$products.productName' },
          totalQuantitySold: { $sum: '$products.quantity' },
          totalRevenueGenerated: { $sum: '$products.total' },
        },
      }
    ]);

    const ecomTopProducts = await Order.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product', 
          productName: { $first: '$products.productName' },
          totalQuantitySold: { $sum: '$products.quantity' },
          totalRevenueGenerated: { $sum: '$products.total' },
        },
      }
    ]);

    // Merge POS + Ecom
    const mergedProductsMap = new Map();
    [...posTopProducts, ...ecomTopProducts].forEach(prod => {
        const key = prod._id.toString();
        if (!mergedProductsMap.has(key)) {
            mergedProductsMap.set(key, { 
                _id: prod._id, 
                productName: prod.productName, 
                totalQuantitySold: 0, 
                totalRevenueGenerated: 0 
            });
        }
        const existing = mergedProductsMap.get(key);
        existing.totalQuantitySold += prod.totalQuantitySold;
        existing.totalRevenueGenerated += prod.totalRevenueGenerated;
    });

    const finalTopProducts = Array.from(mergedProductsMap.values())
        .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
        .slice(0, 10);

    res.status(200).json({ success: true, data: finalTopProducts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating top products report' });
  }
};
