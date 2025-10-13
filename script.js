document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("predictForm");
  const downloadBtn = document.getElementById("downloadReport");

  // ============================================
  // 🔹 DIABETES PREDICTION FORM HANDLER
  // ============================================
  if (!form) {
    console.error("❌ Form element with id 'predictForm' not found in HTML.");
  } else {
    // Helper: convert model output to Low / Medium / High risk
    function mapRiskTier(pred, prob, hba1c, glucose) {
      const p = Number(prob) || 0.5;
      if (pred === 1 || hba1c > 8.0 || glucose > 200) {
        return { risk: "High Risk of Diabetes", confidence: 0.95 };
      } else if (hba1c > 6.5 || glucose > 180) {
        return { risk: "Medium Risk of Diabetes", confidence: 0.75 };
      } else {
        return { risk: "Low Risk of Diabetes", confidence: 0.6 };
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Get input values
      const name = document.getElementById("name").value.trim();
      const age = parseFloat(document.getElementById("age").value) || 0;
      const bmi = parseFloat(document.getElementById("bmi").value) || 0;
      const HbA1c_level = parseFloat(document.getElementById("HbA1c_level").value) || 0;
      const blood_glucose_level = parseFloat(document.getElementById("blood_glucose_level").value) || 0;
      const gender = document.getElementById("gender").value;
      const smoking = document.getElementById("smoking_history").value;
      const hypertension = document.getElementById("hypertension").value === "Yes" ? 1 : 0;
      const heart_disease = document.getElementById("heart_disease").value === "Yes" ? 1 : 0;

      // Derived & encoded features
      const age_bmi = age * bmi;
      const hba1c_glucose = HbA1c_level * blood_glucose_level;
      const ht_hd = hypertension + heart_disease;
      const bmi_squared = bmi * bmi;
      const glucose_squared = blood_glucose_level * blood_glucose_level;
      const gender_Male = gender === "Male" ? 1 : 0;
      const gender_Other = gender === "Other" ? 1 : 0;
      const smoking_history_former = smoking === "former" ? 1 : 0;
      const smoking_history_never = smoking === "never" ? 1 : 0;
      const smoking_history_unknown = smoking === "unknown" ? 1 : 0;

      // Payload to match model structure
      const payload = {
        age,
        hypertension,
        heart_disease,
        bmi,
        HbA1c_level,
        blood_glucose_level,
        age_bmi,
        hba1c_glucose,
        ht_hd,
        bmi_squared,
        glucose_squared,
        gender_Male,
        gender_Other,
        smoking_history_former,
        smoking_history_never,
        smoking_history_unknown,
      };

      document.getElementById("output").textContent = "Predicting...";

      try {
        const response = await fetch("http://localhost:5000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log("🔹 Model response:", result);

        if (!result || result.error) {
          document.getElementById("output").textContent =
            "Error: " + (result.error || "Unknown error");
          return;
        }

        // Extract prediction + probability
        const pred = result?.predictions?.[0]?.values?.[0]?.[0];
        const probLow = result?.predictions?.[0]?.values?.[0]?.[1];
        const probHigh = result?.predictions?.[0]?.values?.[0]?.[2];
        const prob = probHigh || probLow || 0.5;

        const { risk, confidence } = mapRiskTier(pred, prob, HbA1c_level, blood_glucose_level);

        // ✅ Format confidence safely
        const formattedConfidence =
          typeof confidence === "number"
            ? (confidence * 100).toFixed(2) + "%"
            : (parseFloat(confidence) * 100 || 0).toFixed(2) + "%";

        // Display report
        document.getElementById("reportSection").classList.remove("hidden");
        document.getElementById("prediction").textContent = risk;
        document.getElementById("confidence").textContent = formattedConfidence;

        // Show user inputs
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

        document.getElementById("output").textContent = "Prediction complete ✅";
      } catch (err) {
        console.error("❌ Prediction error:", err);
        document.getElementById("output").textContent = "Error predicting";
      }
    });
  }

  // ============================================
  // 🧾 PDF DOWNLOAD HANDLER
  // ============================================
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("Diabetes Prediction Report", 20, 20);

      doc.setFontSize(12);
      doc.text(`Prediction: ${document.getElementById("prediction").textContent}`, 20, 40);
      doc.text(`Confidence: ${document.getElementById("confidence").textContent}`, 20, 50);

      doc.text("Entered Details:", 20, 70);
      const listItems = document.querySelectorAll("#userInputs li");
      let y = 80;
      listItems.forEach((li) => {
        doc.text(`- ${li.textContent}`, 25, y);
        y += 8;
      });

      doc.save("Diabetes_Prediction_Report.pdf");
    });
  } else {
    console.warn("⚠️ No downloadReport button found in HTML.");
  }

  // ============================================
  // ✉️ CONTACT FORM HANDLER (SendGrid Integration)
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
        const res = await fetch("http://localhost:5000/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            message,
            subject: "AI App Feedback",
            phone: "N/A",
          }),
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
  } else {
    console.warn("⚠️ No contact form found in HTML.");
  }
});

 

 




