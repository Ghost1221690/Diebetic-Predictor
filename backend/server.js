// server.js
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import axios from "axios";
import sgMail from "@sendgrid/mail";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// -------------------------
// Setup SendGrid
// -------------------------
if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY not set in .env — contact form won't work.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// -------------------------
// Debug prints for env
// -------------------------
console.log("🔐 IBM_API_KEY present:", !!process.env.IBM_API_KEY);
console.log("🔗 IBM_DEPLOYMENT_URL present:", !!process.env.IBM_DEPLOYMENT_URL);
console.log("✉️ SENDGRID configured:", !!process.env.SENDGRID_API_KEY);

// ===================================================
// 🔐 Fetch IBM IAM Token (reusable)
// ===================================================
async function getAccessToken() {
  if (!process.env.IBM_API_KEY) {
    throw new Error("IBM_API_KEY is not set in environment");
  }

  const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBM_API_KEY}`
  });

  const data = await response.json();
  if (!data.access_token) {
    console.error("❌ Failed to fetch IAM token:", data);
    throw new Error("Could not obtain access token");
  }

  return data.access_token;
}

// ===================================================
// 🔮 Prediction Endpoint
// ===================================================
app.post("/predict", async (req, res) => {
  try {
    const inputData = req.body?.input_data?.[0];
    if (!inputData || !inputData.fields || !inputData.values) {
      return res.status(400).json({
        error: "Invalid input format",
        message: "⚠️ Missing input_data structure."
      });
    }

    const fields = inputData.fields;
    const values = inputData.values[0];

    // Validate numeric values
    const hasInvalid = values.some(
      (v) =>
        v === "" ||
        v === null ||
        v === undefined ||
        typeof v !== "number" ||
        isNaN(v)
    );
    if (hasInvalid) {
      console.error("❌ Invalid input values:", values);
      return res.status(400).json({
        error: "Invalid input: Missing or NaN values detected.",
        message: "⚠️ Please fill all fields correctly before submitting."
      });
    }

    if (!process.env.IBM_DEPLOYMENT_URL) {
      return res.status(500).json({
        error: "Server misconfigured",
        details: "IBM_DEPLOYMENT_URL not set in environment"
      });
    }

    const token = await getAccessToken();

    // Timeout + abort controller
    const controller = new AbortController();
    const TIMEOUT_MS = 90000; // 90 seconds for cold start safety
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const payload = {
      input_data: [
        {
          fields,
          values: [values]
        }
      ]
    };

    const ibmResponse = await fetch(process.env.IBM_DEPLOYMENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!ibmResponse.ok) {
      const text = await ibmResponse.text();
      console.error("❌ IBM model API error:", ibmResponse.status, text);
      return res.status(ibmResponse.status).json({
        error: "Model API call failed",
        details: text
      });
    }

    const result = await ibmResponse.json();
    console.log("✅ Received prediction from IBM:", result);
    res.json(result);

  } catch (err) {
    console.error("❌ Prediction Error:", err.message || err);
    if (err.name === "AbortError") {
      return res.status(504).json({
        error: "Model API call failed",
        details: "Request to model timed out."
      });
    }
    res.status(500).json({
      error: "Model API call failed",
      details: err.message || String(err)
    });
  }
});

// ===================================================
// ✉️ Contact Form Endpoint (SendGrid)
// - Sends an email TO your RECEIVER_EMAIL only
// - Uses subject: "Diabetes Predictor Contact"
// - From: "Om Kawale <SENDER_EMAIL>"
// ===================================================
app.post("/contact", async (req, res) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ success: false, error: "SendGrid not configured on server." });
    }

    const { name, email, message, subject, phone } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: "Missing required fields (name, email, message)." });
    }

    // Build email
    const mailSubject = "Diabetes Predictor Contact"; // as requested
    const senderName = "Om Kawale";
    const fromEmail = process.env.SENDER_EMAIL || "no-reply@example.com";
    const toEmail = process.env.RECEIVER_EMAIL || fromEmail;

    const emailBody = `
      You have a new message from the Diabetes Predictor contact form.

      Name: ${name}
      Email: ${email}
      Phone: ${phone ?? "N/A"}
      Message:
      ${message}

      -------------------------
      (This message was submitted via your web app)
    `;

    const msg = {
      to: toEmail,
      from: `${senderName} <${fromEmail}>`,
      subject: mailSubject,
      text: emailBody,
      html: `<pre style="font-family:inherit;white-space:pre-wrap;">${emailBody}</pre>`
    };

    await sgMail.send(msg);

    return res.json({ success: true, message: "Email sent" });
  } catch (err) {
    console.error("❌ Contact form send failed:", err);
    // SendGrid sometimes returns an array in err.response.body.errors
    let details = err.message;
    if (err.response && err.response.body) details = JSON.stringify(err.response.body);
    return res.status(500).json({ success: false, error: "Failed to send email", details });
  }
});

// ===================================================
// 🔁 Warm-up Model (keeps model awake every 4 minutes)
// ===================================================
if (process.env.IBM_DEPLOYMENT_URL && process.env.IBM_API_KEY) {
  setInterval(async () => {
    try {
      const token = await getAccessToken();

      // dummy values follow your model field order (16 values)
      await axios.post(
        process.env.IBM_DEPLOYMENT_URL,
        {
          input_data: [
            {
              fields: [
                "age","hypertension","heart_disease","bmi","HbA1c_level","blood_glucose_level",
                "age_bmi","hba1c_glucose","ht_hd","bmi_squared","glucose_squared",
                "gender_Male","gender_Other","smoking_history_former","smoking_history_never","smoking_history_unknown"
              ],
              values: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
            }
          ]
        },
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          timeout: 25000 // give it up to 25s to wake
        }
      );

      console.log("🔥 Warm-up ping sent to IBM model");
    } catch (err) {
      // don't crash server if warm-up fails
      console.log("⚠️ Warm-up ping failed (this is OK occasionally):", err.message || err.toString());
    }
  }, 4 * 60 * 1000); // every 4 minutes
} else {
  console.warn("⚠️ Warm-up disabled: IBM_DEPLOYMENT_URL or IBM_API_KEY missing.");
}

// ===================================================
// 🚀 Start server
// ===================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});







