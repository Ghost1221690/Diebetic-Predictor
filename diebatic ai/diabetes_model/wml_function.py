import joblib
import pandas as pd
import json
import os

def score(input_data):
    """
    IBM WatsonX Deployment Function
    --------------------------------
    Loads the diabetes model and predicts outcomes from input data.
    """

    # Load model (only 1 .pkl file)
    model_path = "diabetes_model.pkl"
    features_path = "model_features.json"

    if not os.path.exists(model_path) or not os.path.exists(features_path):
        return {"error": "Model or feature file not found."}

    model = joblib.load(model_path)

    with open(features_path, "r") as f:
        features = json.load(f)

    # Prepare input data
    try:
        if isinstance(input_data, str):
            input_data = json.loads(input_data)
        df = pd.DataFrame(input_data)
    except Exception as e:
        return {"error": f"Invalid input format: {str(e)}"}

    # Align with model features
    df = df.reindex(columns=features, fill_value=0)

    # Predict
    try:
        preds = model.predict(df)
        probs = model.predict_proba(df)[:, 1]
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

    # Return response
    return {
        "predictions": preds.tolist(),
        "probabilities": probs.tolist()
    }


