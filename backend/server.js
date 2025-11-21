import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import axios from "axios";
import sgMail from "@sendgrid/mail";

dotenv.config();

const app = express();

// ===================================================
// ✅ CORS Configuration
// ===================================================
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://ghost1221690.github.io",
  "https://your-frontend-site.firebaseapp.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("🚫 Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.options("*", cors());

// ===================================================
// Middleware
// ===================================================
app.use(express.json());
app.use(express.static("public"));

// ===================================================
// SendGrid Setup
// ===================================================
if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY not set");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ===================================================
// 🔐 IBM IAM Token Fetcher
// ===================================================
async function getAccessToken() {
  if (!process.env.IBM_API_KEY) {
    throw new Error("IBM_API_KEY is missing");
  }

  const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBM_API_KEY}`
  });

  const data = await response.json();
  if (!data.access_token) {
    console.error("❌ Failed to fetch IAM token:", data);
    throw new Error("Failed to get IBM IAM Token");
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
        error: "Invalid input",
        message: "Missing fields or values",
      });
    }

    const fields = inputData.fields;
    const values = inputData.values[0];

    // Validate numeric values
    const invalid = values.some(
      (v) => v === "" || v === null || v === undefined || typeof v !== "number" || isNaN(v)
    );
    if (invalid) {
      return res.status(400).json({
        error: "Invalid input values",
        message: "Please enter valid numbers.",
      });
    }

    if (!process.env.IBM_DEPLOYMENT_URL) {
      return res.status(500).json({
        error: "Server misconfigured",
        details: "IBM_DEPLOYMENT_URL missing"
      });
    }

    const token = await getAccessToken();

    // Timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const payload = {
      input_data: [{ fields, values: [values] }]
    };

    const response = await fetch(process.env.IBM_DEPLOYMENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: "Model API Error",
        details: errorText
      });
    }

    const result = await response.json();
    res.json(result);

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({
        error: "Model timeout",
        details: "IBM model took too long"
      });
    }

    res.status(500).json({
      error: "Prediction failed",
      details: err.message
    });
  }
});

// ===================================================
// ✉️ Contact Form (SendGrid Email)
// ===================================================
app.post("/contact", async (req, res) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ success: false, error: "SendGrid not configured" });
    }

    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const senderName = "Diebetic Ai";
    const fromEmail = process.env.SENDER_EMAIL;
    const toEmail = process.env.RECEIVER_EMAIL || fromEmail;

    const emailBody = `
New Contact Form Message:

Name: ${name}
Email: ${email}
Phone: ${phone ?? "N/A"}

Message:
${message}
    `;

    await sgMail.send({
      to: toEmail,
      from: `${senderName} <${fromEmail}>`,
      subject: "Diabetes Predictor Contact",
      text: emailBody
    });

    res.json({ success: true, message: "Email sent" });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to send email",
      details: err.message
    });
  }
});

// ===================================================
// 🔥 Warm-up IBM Model Every 4 Minutes
// ===================================================
if (process.env.IBM_DEPLOYMENT_URL && process.env.IBM_API_KEY) {
  setInterval(async () => {
    try {
      const token = await getAccessToken();

      await axios.post(
        process.env.IBM_DEPLOYMENT_URL,
        {
          input_data: [
            {
              fields: [
                "age", "hypertension", "heart_disease", "bmi", "HbA1c_level",
                "blood_glucose_level", "age_bmi", "hba1c_glucose", "ht_hd",
                "bmi_squared", "glucose_squared", "gender_Male", "gender_Other",
                "smoking_history_former", "smoking_history_never", "smoking_history_unknown"
              ],
              values: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("🔥 Warm-up ping sent");

    } catch (err) {
      console.log("⚠️ Warm-up failed:", err.message);
    }
  }, 4 * 60 * 1000); // every 4 minutes
}

// ===================================================
// 🔄 CRON JOB — PING RENDER URL TO PREVENT SLEEP
// ===================================================
const SELF_URL = process.env.RENDER_INTERNAL_URL || "https://diebetic-predictor-1.onrender.com";

setInterval(async () => {
  try {
    await fetch(SELF_URL);
    console.log("⏳ Self-ping OK:", SELF_URL);
  } catch (err) {
    console.log("⚠️ Self-ping failed:", err.message);
  }
}, 10 * 60 * 1000); // every 10 minutes

// ===================================================
// Health Check
// ===================================================
app.get("/", (req, res) => {
  res.json({ status: "Backend Alive 🚀", time: new Date().toISOString() });
});

// ===================================================
// Start Server
// ===================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});








