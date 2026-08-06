const dotenv = require("dotenv");
dotenv.config(); // must be first — loads .env before anything else reads process.env

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); // force Google DNS (fixes local DNS proxy blocking MongoDB SRV)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const userrouter = require("./routes/Userroutes");
const categoryrouter = require("./routes/Categoryroutes");
const productrouter = require("./routes/Productroutes");
const Bagroutes = require("./routes/Bagroutes");
const Wishlistroutes = require("./routes/Wishlistroutes");
const OrderRoutes = require("./routes/OrderRoutes");
const RecentlyViewedRoutes = require("./routes/RecentlyViewedRoutes");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

app.get("/", (req, res) => {
  res.send("Myntra backend is working");
});

app.use("/user", userrouter);
app.use("/category", categoryrouter);
app.use("/product", productrouter);
app.use("/bag", Bagroutes);
app.use("/wishlist", Wishlistroutes);
app.use("/order", OrderRoutes);
app.use("/recently-viewed", RecentlyViewedRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
