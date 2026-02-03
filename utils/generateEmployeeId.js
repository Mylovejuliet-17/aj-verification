const Counter = require("../models/Counter");

async function getNextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

function pad(num) {
  return String(num).padStart(3, "0");
}

async function generateEmployeeId(position = "") {
  const isCEO = position.toLowerCase().includes("ceo");
  const prefix = isCEO ? "AJ-CEO" : "AJ-EMP";
  const seq = await getNextSequence(prefix);
  return `${prefix}-${pad(seq)}`;
}

module.exports = generateEmployeeId;
