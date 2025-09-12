const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Serve uploaded images statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Database connection
let db;
(async () => {
  db = await mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "crackers",
  });
})();

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ API: Get Categories & Products
app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories");
    const [items] = await db.query("SELECT * FROM products");
    const categories = rows.map((cat) => ({
      ...cat,
      items: items.filter((p) => p.categoryId === cat.id),
    }));
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});

// ✅ API: Add Product (with image upload)
app.post("/api/products", upload.single("img"), async (req, res) => {
  try {
    const { name, Mkt_price, our_price, categoryId } = req.body;
    const imgPath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !Mkt_price || !our_price || !categoryId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [result] = await db.query(
      `INSERT INTO products (name, Mkt_price, our_price, img, categoryId) VALUES (?, ?, ?, ?, ?)`,
      [name, Mkt_price, our_price, imgPath, categoryId]
    );

    res.json({
      success: true,
      message: "Product added successfully",
      productId: result.insertId,
      img: imgPath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding product" });
  }
});

// ✅ API: Update Product (with optional new image)
app.put("/api/products/:id", upload.single("img"), async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, Mkt_price, our_price, categoryId } = req.body;
    const imgPath = req.file ? `/uploads/${req.file.filename}` : req.body.img;

    if (!name || !Mkt_price || !our_price || !categoryId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [result] = await db.query(
      `UPDATE products 
       SET name = ?, Mkt_price = ?, our_price = ?, img = ?, categoryId = ? 
       WHERE id = ?`,
      [name, Mkt_price, our_price, imgPath, categoryId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      img: imgPath,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating product" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { name, phone, address, cart } = req.body;

  if (!cart || cart.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  try {
    // Insert order
    const [result] = await db.query(
      "INSERT INTO orders (name, phone, address) VALUES (?, ?, ?)",
      [name, phone, address]
    );
    const orderId = result.insertId;

    // Insert order items
    for (const item of cart) {
      await db.query(
        "INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)",
        [orderId, item.id, item.Qty, item.our_price]
      );
    }

    res.json({ success: true, message: "Order placed", orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error placing order" });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
