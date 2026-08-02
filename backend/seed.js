const dotenv = require("dotenv");
dotenv.config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");
const Product = require("./models/Product");
const Category = require("./models/Category");

const products = [
  {
    name: "Casual White T-Shirt",
    brand: "Roadster",
    price: 499,
    discount: "60% OFF",
    description: "Classic white t-shirt made from premium cotton. Perfect for everyday wear with a comfortable regular fit.",
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop",
    ],
  },
  {
    name: "Denim Jacket",
    brand: "Levis",
    price: 2499,
    discount: "40% OFF",
    description: "Classic denim jacket with a modern twist. Features premium quality denim and comfortable fit.",
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&auto=format&fit=crop",
    ],
  },
  {
    name: "Summer Dress",
    brand: "ONLY",
    price: 1299,
    discount: "50% OFF",
    description: "Flowy summer dress perfect for warm weather. Made from lightweight fabric with a flattering cut.",
    sizes: ["XS", "S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1623609163859-ca93c959b98a?w=500&auto=format&fit=crop",
    ],
  },
  {
    name: "Classic Sneakers",
    brand: "Nike",
    price: 3499,
    discount: "30% OFF",
    description: "Versatile sneakers that combine style and comfort. Perfect for both casual wear and light exercise.",
    sizes: ["UK6", "UK7", "UK8", "UK9", "UK10"],
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&auto=format&fit=crop",
    ],
  },
  {
    name: "Floral Kurti",
    brand: "Biba",
    price: 899,
    discount: "45% OFF",
    description: "Beautiful floral printed kurti perfect for festive and casual occasions.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4b2dd6?w=500&auto=format&fit=crop",
    ],
  },
  {
    name: "Slim Fit Chinos",
    brand: "H&M",
    price: 1499,
    discount: "35% OFF",
    description: "Modern slim fit chinos for a smart casual look. Comfortable stretch fabric.",
    sizes: ["28", "30", "32", "34", "36"],
    images: [
      "https://images.unsplash.com/photo-1598522325074-042db73aa4e6?w=500&auto=format&fit=crop",
    ],
  },
];

const categoryData = [
  {
    name: "Men",
    subcategory: ["T-Shirts", "Shirts", "Jeans", "Trousers", "Suits", "Activewear"],
    image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop",
    productIndexes: [0, 1, 5],
  },
  {
    name: "Women",
    subcategory: ["Dresses", "Tops", "Ethnic Wear", "Western Wear", "Activewear"],
    image: "https://images.unsplash.com/photo-1618244972963-dbad0c4abf18?w=500&auto=format&fit=crop",
    productIndexes: [2, 4],
  },
  {
    name: "Kids",
    subcategory: ["Boys Clothing", "Girls Clothing", "Infants", "Toys", "School Essentials"],
    image: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop",
    productIndexes: [0, 2],
  },
  {
    name: "Footwear",
    subcategory: ["Sneakers", "Sandals", "Heels", "Boots", "Loafers"],
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop",
    productIndexes: [3],
  },
  {
    name: "Beauty",
    subcategory: ["Makeup", "Skincare", "Haircare", "Fragrances", "Personal Care"],
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop",
    productIndexes: [],
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log("Cleared existing data");

    const insertedProducts = await Product.insertMany(products);
    console.log(`Inserted ${insertedProducts.length} products`);

    const categoriesToInsert = categoryData.map((cat) => ({
      name: cat.name,
      subcategory: cat.subcategory,
      image: cat.image,
      productId: cat.productIndexes.map((i) => insertedProducts[i]._id),
    }));

    const insertedCategories = await Category.insertMany(categoriesToInsert);
    console.log(`Inserted ${insertedCategories.length} categories`);

    console.log("Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
};

seed();
