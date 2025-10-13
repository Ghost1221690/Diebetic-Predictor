import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import sgMail from "@sendgrid/mail";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public")); // Frontend folder

// =============================
// 🔹 SendGrid Configuration
// =============================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// =============================
// 🔹 Function to get IAM token from IBM Cloud
// =============================
async function getAccessToken() {
  const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.MODEL_API_KEY}`,
  });

  const data = await response.json();
  if (data.access_token) return data.access_token;
  throw new Error("Failed to obtain IAM access token");
}

// =============================
// 🔹 ROUTE 1: Diabetes Prediction
// =============================
app.post("/predict", async (req, res) => {
  try {
    const token = await getAccessToken();

    const fields = [
      "age","hypertension","heart_disease","bmi","HbA1c_level",
      "blood_glucose_level","age_bmi","hba1c_glucose","ht_hd",
      "bmi_squared","glucose_squared","gender_Male","gender_Other",
      "smoking_history_former","smoking_history_never","smoking_history_unknown"
    ];

    const values = [
      req.body.age, req.body.hypertension, req.body.heart_disease, req.body.bmi,
      req.body.HbA1c_level, req.body.blood_glucose_level, req.body.age_bmi,
      req.body.hba1c_glucose, req.body.ht_hd, req.body.bmi_squared,
      req.body.glucose_squared, req.body.gender_Male, req.body.gender_Other,
      req.body.smoking_history_former, req.body.smoking_history_never,
      req.body.smoking_history_unknown
    ];

    const response = await fetch(process.env.MODEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ input_data: [{ fields, values: [values] }] }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: "Model API call failed", details: text });
    }

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Prediction Error:", err);
    res.status(500).json({ error: "Failed to fetch prediction", details: err.message });
  }
});

// =============================
// 🔹 ROUTE 2: Contact Form (SendGrid Email)
// =============================
app.post("/contact", async (req, res) => {
  const { name, phone, email, subject, message } = req.body;

  const msg = {
    to: process.env.RECEIVER_EMAIL, // Your inbox
    from: process.env.SENDER_EMAIL, // Verified sender
    subject: `AI App Contact: ${subject || "No Subject"}`,
    text: `
      Name: ${name}
      Phone: ${phone}
      Email: ${email}
      Message: ${message}
    `,
    html: `
      <h3>New Contact Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong> ${message}</p>
    `
  };

  try {
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (error) {
    console.error("SendGrid Error:", error.response ? error.response.body : error);
    res.status(500).json({ success: false, error: "Email failed to send." });
  }
});

// =============================
// 🔹 Health Check
// =============================
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "AI App Server is alive" });
});

// =============================
// 🔹 START SERVER
// =============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));






