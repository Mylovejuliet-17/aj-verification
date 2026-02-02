const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// ✅ Health / Home
app.get("/", (req, res) => res.send("AJ Verification API is LIVE ✅"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ✅ MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ✅ Schema + Model
const VerificationSchema = new mongoose.Schema(
  {
    idNumber: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

const Verification = mongoose.model("Verification", VerificationSchema);

// ✅ Seed endpoint (create sample record)
app.post("/seed", async (req, res) => {
  try {
    const doc = await Verification.create(req.body);
    res.status(201).json({ created: true, data: doc });
  } catch (err) {
    res.status(400).json({ created: false, error: err.message });
  }
});

// ✅ The main endpoint: verify an ID
app.post("/verify", async (req, res) => {
  try {
    const { idNumber } = req.body;
    if (!idNumber) return res.status(400).json({ error: "idNumber is required" });

    const record = await Verification.findOne({ idNumber });

    if (!record) {
      return res.json({ valid: false, message: "Not found" });
    }

    return res.json({
      valid: record.status === "active",
      idNumber: record.idNumber,
      fullName: record.fullName,
      status: record.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Render port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
