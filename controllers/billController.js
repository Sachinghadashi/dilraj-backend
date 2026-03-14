const Bill = require('../models/Bill');
const Product = require('../models/Product');

// Helper function to generate unique bill numbers (e.g., BILL-20260308-001)
const generateBillNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  // Find the last bill for today
  const lastBill = await Bill.findOne({ 
    billNumber: { $regex: `^BILL-${dateStr}-` } 
  }).sort({ createdAt: -1 });

  let seqStr = "001";
  if (lastBill) {
    const lastSeq = parseInt(lastBill.billNumber.split('-')[2]);
    seqStr = String(lastSeq + 1).padStart(3, '0');
  }

  return `BILL-${dateStr}-${seqStr}`;
};

// @desc    Generate a new bill
// @route   POST /api/bills
// @access  Private (Cashier, Admin)
exports.createBill = async (req, res) => {
  try {
    const { products, discount, paymentMethod, customerPhone } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No products provided for billing' });
    }

    let subTotal = 0;
    const billProducts = [];

    // Verify stock and calculate totals securely from DB prices (not trusting frontend prices)
    for (const item of products) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Not enough stock for ${product.productName}. Available: ${product.stock}` });
      }

      const itemTotal = product.price * item.quantity;
      subTotal += itemTotal;

      billProducts.push({
        product: product._id,
        productName: product.productName,
        barcode: product.barcode,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
      });

      // Automatically update stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Apply Tax (Assuming standard 18% GST across the board for simplicity, can be adjusted per category)
    const taxRate = 0.18; 
    const taxAmount = parseFloat((subTotal * taxRate).toFixed(2));
    
    // Calculate final total (Subtotal + GST - Discount)
    const parsedDiscount = discount || 0;
    const finalTotalAmount = parseFloat((subTotal + taxAmount - parsedDiscount).toFixed(2));

    const billNumber = await generateBillNumber();

    const bill = await Bill.create({
      billNumber,
      products: billProducts,
      subTotal,
      tax: taxAmount,
      discount: parsedDiscount,
      totalAmount: finalTotalAmount,
      paymentMethod: paymentMethod || 'Cash',
      cashierId: req.user.id, // Authenticated user
      customerPhone,
    });

    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error generating bill: ' + error.message, stack: error.stack });
  }
};

// @desc    Get all bills (Admin sees all, Cashier sees theirs)
// @route   GET /api/bills
// @access  Private (Cashier, Admin)
exports.getBills = async (req, res) => {
  try {
    let query = Bill.find().populate('cashierId', 'name email');

    // If user is cashier, only return their bills
    if (req.user.role === 'cashier') {
      query = Bill.find({ cashierId: req.user.id }).populate('cashierId', 'name email');
    }

    // Sort by most recent
    query = query.sort('-createdAt');

    const bills = await query;

    res.status(200).json({ success: true, count: bills.length, data: bills });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving bills' });
  }
};

// @desc    Get specific bill by ID
// @route   GET /api/bills/:id
// @access  Private (Cashier, Admin)
exports.getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('cashierId', 'name email');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    // Prevent Cashier A from viewing Cashier B's bill
    if (req.user.role === 'cashier' && bill.cashierId._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this bill' });
    }

    res.status(200).json({ success: true, data: bill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving bill detail' });
  }
};
