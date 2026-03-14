const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public (Customers, Cashiers, Admins)
exports.getProducts = async (req, res) => {
  try {
    let query;

    // Optional: Filter by category or search term if provided in URL queries
    const reqQuery = { ...req.query };
    
    // Fields to exclude from exact matching
    const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
    removeFields.forEach(param => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    
    // Create query object
    let parsedQuery = JSON.parse(queryStr);

    // Search functionality based on productName or barcode
    if (req.query.search) {
        parsedQuery = {
            ...parsedQuery,
            $or: [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { barcode: { $regex: req.query.search, $options: 'i' } }
            ]
        };
    }

    query = Product.find(parsedQuery);

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    const products = await query;
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error retrieving products' });
  }
};

// @desc    Get single product by ID or Barcode
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    // Check if the param is a valid object ID or a barcode
    let product;
    
    // Simple check: if it's purely letters/numbers it might be a valid mongo ID, 
    // but barcodes are also string of numbers. We'll try to find by ID first, then by barcode.
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
        product = await Product.findById(req.params.id);
    }
    
    // If not found by ID (or wasn't a valid ID format), search by barcode
    if (!product) {
        product = await Product.findOne({ barcode: req.params.id });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error retrieving product' });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin only)
exports.createProduct = async (req, res) => {
  try {
    // Ensure barcode is unique (Handled by DB Schema as well, but good to check gracefully here if needed)
    const product = await Product.create(req.body);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    if(error.code === 11000) { // MongoDB duplicate key error (for barcode)
        return res.status(400).json({ success: false, message: 'A product with this barcode already exists' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error creating product', error: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin only)
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Update product
    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error updating product' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error deleting product' });
  }
};
