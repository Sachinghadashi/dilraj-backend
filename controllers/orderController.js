const Order = require('../models/Order');
const Product = require('../models/Product');

// Helper function to generate unique Order numbers
const generateOrderNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  const lastOrder = await Order.findOne({ 
    orderId: { $regex: `^ORD-${dateStr}-` } 
  }).sort({ createdAt: -1 });

  let seqStr = "0001";
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderId.split('-')[2]);
    seqStr = String(lastSeq + 1).padStart(4, '0');
  }

  return `ORD-${dateStr}-${seqStr}`;
};

// @desc    Create new E-commerce order
// @route   POST /api/orders
// @access  Private (Customer)
exports.createOrder = async (req, res) => {
  try {
    const { products, deliveryAddress, paymentMethod, deliveryFee = 10, handlingFee = 5 } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items' });
    }

    let totalPrice = 0;
    const orderItems = [];

    // Verify stock and calculate correct prices
    for (const item of products) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for ${product.productName}` });
      }

      const itemTotal = product.price * item.quantity;
      totalPrice += itemTotal;

      orderItems.push({
        product: product._id,
        productName: product.productName,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
      });

      // Update actual product stock
      product.stock -= item.quantity;
      await product.save();
    }

    const orderId = await generateOrderNumber();

    const order = await Order.create({
      orderId,
      customerId: req.user.id, // Authenticated customer
      products: orderItems,
      deliveryAddress,
      totalPrice: totalPrice + deliveryFee + handlingFee,
      deliveryFee,
      handlingFee,
      paymentMethod,
      paymentStatus: paymentMethod === 'Cash On Delivery' ? 'Pending' : 'Completed', // Simplified for online payment hook logic
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error placing order' });
  }
};

// @desc    Get logged in user's orders (Customer History)
// @route   GET /api/orders/myorders
// @access  Private (Customer)
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching your orders' });
  }
};

// @desc    Get single order details by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('customerId', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Security: Only Admin or the Customer who placed the order can view it
    if (req.user.role !== 'admin' && order.customerId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching order details' });
  }
};

// @desc    Get all orders (Admin views all orders for delivery management)
// @route   GET /api/orders
// @access  Private (Admin only)
exports.getOrders = async (req, res) => {
  try {
    // Optionally filter by orderStatus (?status=Pending)
    const filters = {};
    if (req.query.status) {
      filters.orderStatus = req.query.status;
    }

    const orders = await Order.find(filters)
      .populate('customerId', 'name email')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching all orders' });
  }
};

// @desc    Update order status to 'Processing', 'Delivered', etc.
// @route   PUT /api/orders/:id/status
// @access  Private (Admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // You cannot change the status of a cancelled or delivered order
    if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') {
         return res.status(400).json({ success: false, message: `Cannot update a ${order.orderStatus} order`});
    }

    order.orderStatus = req.body.status;

    if (req.body.status === 'Delivered') {
      order.deliveryDate = Date.now();
      order.paymentStatus = 'Completed'; // Specifically for COD when delivered
    }

    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
};

// @desc    Cancel order within 2 minutes of placement
// @route   PUT /api/orders/:id/cancel
// @access  Private (Customer only)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Delivered') {
      return res.status(400).json({ success: false, message: `Cannot cancel a ${order.orderStatus} order` });
    }

    // Check 2 minute limit
    const timeElapsed = Date.now() - new Date(order.createdAt).getTime();
    const twoMinutes = 2 * 60 * 1000;
    
    if (timeElapsed > twoMinutes) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled after 2 minutes' });
    }

    // Restore stock
    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    res.status(200).json({ success: true, data: order, message: 'Order successfully cancelled' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error cancelling order' });
  }
};
