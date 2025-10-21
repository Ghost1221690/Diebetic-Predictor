document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("predictForm");
  const downloadBtn = document.getElementById("downloadReport");

  // 🔹 Risk Mapping
  function mapRiskTier(pred, HbA1c_level, blood_glucose_level) {
    if (pred === 1 || HbA1c_level > 8.0 || blood_glucose_level > 190) {
      return { risk: "High Risk of Diabetes", confidence: 0.95 };
    } else if (HbA1c_level > 6.5 || blood_glucose_level > 180) {
      return { risk: "Medium Risk of Diabetes", confidence: 0.75 };
    } else {
      return { risk: "Low Risk of Diabetes", confidence: 0.6 };
    }
  }

  // 🧠 Prediction Form Handler
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      document.getElementById("output").textContent = "Predicting...";

      // Collect inputs
      const name = document.getElementById("name").value.trim();
      const age = parseFloat(document.getElementById("age").value);
      const bmi = parseFloat(document.getElementById("bmi").value);
      const HbA1c_level = parseFloat(document.getElementById("HbA1c_level").value);
      const blood_glucose_level = parseFloat(document.getElementById("blood_glucose_level").value);
      const gender = document.getElementById("gender").value;
      const smoking = document.getElementById("smoking_history").value;
      const hypertension = document.getElementById("hypertension").value === "Yes" ? 1 : 0;
      const heart_disease = document.getElementById("heart_disease").value === "Yes" ? 1 : 0;

      // Validate inputs
      if (!name || age <= 0 || bmi <= 0 || HbA1c_level <= 0 || blood_glucose_level <= 0 ||
        !gender || !smoking) {
        document.getElementById("output").textContent = "⚠️ Please fill all fields correctly.";
        return;
      }

      // Encode categorical & derived features
      const gender_Male = gender === "Male" ? 1 : 0;
      const gender_Other = gender === "Other" ? 1 : 0;
      const smoking_history_former = smoking === "former" ? 1 : 0;
      const smoking_history_never = smoking === "never" ? 1 : 0;
      const smoking_history_unknown = smoking === "unknown" ? 1 : 0;
      const age_bmi = age * bmi;
      const hba1c_glucose = HbA1c_level * blood_glucose_level;
      const ht_hd = hypertension * heart_disease;
      const bmi_squared = bmi * bmi;
      const glucose_squared = blood_glucose_level * blood_glucose_level;

      const fields = [
        "age","hypertension","heart_disease","bmi","HbA1c_level",
        "blood_glucose_level","age_bmi","hba1c_glucose","ht_hd",
        "bmi_squared","glucose_squared","gender_Male","gender_Other",
        "smoking_history_former","smoking_history_never","smoking_history_unknown"
      ];

      const values = [[
        age, hypertension, heart_disease, bmi, HbA1c_level,
        blood_glucose_level, age_bmi, hba1c_glucose, ht_hd,
        bmi_squared, glucose_squared, gender_Male, gender_Other,
        smoking_history_former, smoking_history_never, smoking_history_unknown
      ]];

      const payload = { input_data: [{ fields, values }] };

      try {
        console.log("🟡 Sending payload to backend:", JSON.stringify(payload, null, 2));

        const response = await fetch("https://diebetic-predictor-1.onrender.com/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("❌ Server response error:", text);
          document.getElementById("output").textContent = "⚠️ Server error. Check backend.";
          return;
        }

        const result = await response.json();
        const pred = result?.predictions?.[0]?.values?.[0]?.[0] ?? 0;

        const { risk, confidence } = mapRiskTier(pred, HbA1c_level, blood_glucose_level);
        const formattedConfidence = (confidence * 100).toFixed(2) + "%";

        // Display results
        document.getElementById("reportSection").classList.remove("hidden");
        document.getElementById("prediction").textContent = risk;
        document.getElementById("confidence").textContent = formattedConfidence;
        document.getElementById("output").textContent = "✅ Prediction Complete";

        // Show entered details
        const userInputsList = document.getElementById("userInputs");
        userInputsList.innerHTML = `
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Age:</strong> ${age}</li>
          <li><strong>BMI:</strong> ${bmi}</li>
          <li><strong>HbA1c Level:</strong> ${HbA1c_level}</li>
          <li><strong>Blood Glucose Level:</strong> ${blood_glucose_level}</li>
          <li><strong>Gender:</strong> ${gender}</li>
          <li><strong>Smoking History:</strong> ${smoking}</li>
          <li><strong>Hypertension:</strong> ${hypertension ? "Yes" : "No"}</li>
          <li><strong>Heart Disease:</strong> ${heart_disease ? "Yes" : "No"}</li>
        `;
      } catch (err) {
        console.error("❌ Prediction error:", err);
        document.getElementById("output").textContent = "⚠️ Error connecting to prediction server.";
      }
    });
  }

  // 🧾 PDF Download Handler
  // 🧾 PDF Download Handler
downloadBtn.addEventListener("click", () => {
  if (!window.jspdf) {
    alert("⚠️ jsPDF not loaded.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ----------------------
  // 1️⃣ Add Logo at the top
  // ----------------------
  const logo = document.getElementById("siteLogo"); // <img id="siteLogo" src="...">
  let startY = 20; // starting y position for text
  if (logo) {
    const canvas = document.createElement("canvas");
    canvas.width = logo.naturalWidth;
    canvas.height = logo.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(logo, 0, 0);
    const imgData = canvas.toDataURL("image/png");

    const imgWidth = 40; // width in PDF units
    const imgHeight = (logo.naturalHeight / logo.naturalWidth) * imgWidth; // maintain aspect ratio
    doc.addImage(imgData, "PNG", 20, 10, imgWidth, imgHeight);

    startY = 10 + imgHeight + 10; // leave space after logo
  }

  // ----------------------
  // 2️⃣ Report Title
  // ----------------------
  doc.setFontSize(16);
  doc.text("Diabetes Prediction Report", 70, startY);

  // ----------------------
  // 3️⃣ Prediction Info
  // ----------------------
  doc.setFontSize(12);
  let infoY = startY + 20; // some space after title
  doc.text(`Prediction: ${document.getElementById("prediction").textContent}`, 20, infoY);
  doc.text(`Confidence: ${document.getElementById("confidence").textContent}`, 20, infoY + 10);

  // ----------------------
  // 4️⃣ Entered Details
  // ----------------------
  doc.text("Entered Details:", 20, infoY + 30);
  const listItems = document.querySelectorAll("#userInputs li");
  let y = infoY + 40;
  listItems.forEach(li => {
    doc.text(`- ${li.textContent}`, 25, y);
    y += 8;
  });

  doc.save("Diabetes_Prediction_Report.pdf");
});

  

  // ============================================
  // ✉️ Contact Form Handler
  // ============================================
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    const statusBox = document.createElement("p");
    statusBox.id = "contactStatus";
    statusBox.style.marginTop = "10px";
    statusBox.style.fontWeight = "500";
    contactForm.appendChild(statusBox);

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("contactName").value.trim();
      const email = document.getElementById("contactEmail").value.trim();
      const message = document.getElementById("contactMessage").value.trim();

      if (!name || !email || !message) {
        statusBox.textContent = "⚠️ Please fill all fields.";
        statusBox.style.color = "orange";
        return;
      }

      statusBox.textContent = "📨 Sending message...";
      statusBox.style.color = "#007bff";

      try {
        const res = await fetch("https://diebetic-predictor-1.onrender.com/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message, subject: "AI App Feedback", phone: "N/A" }),
        });

        const data = await res.json();
        if (data.success) {
          statusBox.textContent = "✅ Message sent successfully!";
          statusBox.style.color = "green";
          contactForm.reset();
        } else {
          statusBox.textContent = "❌ Failed to send message.";
          statusBox.style.color = "red";
        }
      } catch (error) {
        console.error("❌ Contact form error:", error);
        statusBox.textContent = "⚠️ Server connection error.";
        statusBox.style.color = "red";
      }
    });
  }
});

 

 




