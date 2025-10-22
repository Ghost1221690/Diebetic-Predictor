# 🩺 Diabetes Prediction API (Flask)

A production-ready, Flask-based REST API for predicting the risk of diabetes using a pre-trained machine learning model. The API accepts health-related parameters in JSON format and returns a structured prediction response containing both binary prediction results and a mapped risk tier.

---

## 📘 Table of Contents

1. Overview
2. Features
3. Tech Stack
4. Architecture
5. Data Flow
6. API Specification
7. Request Schema
8. Response Schema
9. Error Handling
10. Environment Variables
11. Folder Structure
12. Running Locally
13. Example Usage (CLI & Code)
14. Logging & Monitoring
15. Security Notes
16. Versioning Strategy
17. Contributing
18. License

---

## 1. Overview

Live Demo: https://ghost1221690.github.io/Diebetic-Predictor/

This API provides a lightweight and scalable ML inference service to determine diabetes risk from commonly collected medical parameters. The model is pre-trained and exported for real-time inference. This API is designed for integration with mobile apps, dashboards, IoT health devices, and cloud-based medical applications.

---

## 2. Features

* ✅ Pure Flask backend (only API)
* ✅ Fast JSON-based inference
* ✅ Pre-trained ML model
* ✅ Risk tier mapping
* ✅ Cross-platform support (mobile/web/desktop)
* ✅ Can be extended with auth & database

---

## 3. Tech Stack

| Component         | Technology                 |
| ----------------- | -------------------------- |
| Backend API       | Flask                      |
| ML Model          | scikit-learn (pre-trained) |
| Inference Runtime | Python                     |
| Input/Output      | JSON                       |

---

## 4. Architecture

```
[ Client / App / Frontend ] --> [ Flask API ] --> [ Pre-trained Model ] --> [ Prediction Response ]
```

---

## 5. Data Flow

```
Request JSON --> Validation --> Model Inference --> Risk Tier Mapping --> Response
```

---

## 6. API Specification

| Method | Endpoint | Description                          |
| ------ | -------- | ------------------------------------ |
| POST   | /predict | Returns diabetes risk classification |

---

## 7. Request Schema (JSON)

```
{
  "pregnancies": number,
  "glucose": number,
  "blood_pressure": number,
  "skin_thickness": number,
  "insulin": number,
  "bmi": number,
  "dpf": number,
  "age": number
}
```

---

## 8. Response Schema (JSON)

```
{
  "prediction": 0 or 1,
  "risk_tier": "Low Risk" | "Moderate Risk" | "High Risk",
  "message": "string"
}
```

---

## 9. Error Handling

Errors are returned in this format:

```
{
  "error": true,
  "message": "Description of the error"
}
```

---

## 10. Environment Variables

| Variable   | Description            |
| ---------- | ---------------------- |
| MODEL_PATH | Path to saved ML model |

---

## 11. Folder Structure

```
project-root/
│
├── app.py
├── model.pkl
├── requirements.txt
└── README.md

Accroding to your project need.
```

---

## 12. Running Locally

```
python app.py
```

API runs at `http://127.0.0.1:5000/predict`

---

## 13. Example Usage

### cURL

```
curl -X POST http://127.0.0.1:5000/predict -H "Content-Type: application/json" -d '{"glucose":120,...}'
```

### JavaScript

```
fetch('/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
.then(res=>res.json())
.then(console.log);
```

### Python

```
import requests
requests.post('http://127.0.0.1:5000/predict',json=data).json()
```

---

## 14. Logging & Monitoring

To be extended: API can be configured to log all prediction requests.

---

## 15. Security Notes

* Always validate input
* Use HTTPS in production
* Do not expose model internals

---

## 16. Versioning Strategy

Semantic Versioning: MAJOR.MINOR.PATCH

---

## 17. Contributing

Pull requests and feature suggestions are welcome.

---

## 🖼️ Screenshots

<img width="405" height="837" alt="image" src="https://github.com/user-attachments/assets/b7eb196b-1328-4ea7-b602-4bf2c5178723" />
<img width="380" height="831" alt="image" src="https://github.com/user-attachments/assets/d093e610-73eb-4bb1-bc70-f03af15d8579" />
<img width="380" height="833" alt="image" src="https://github.com/user-attachments/assets/8c87f0ea-d274-4f21-8793-150ad0277869" />



---

## 18. License

MIT License

---


