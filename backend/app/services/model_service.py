import joblib

model = joblib.load("models/fake_news_model.pkl")
vectorizer = joblib.load("models/vectorizer.pkl")

def predict_fake_news(text):

    text_vec = vectorizer.transform([text])

    prediction = model.predict(text_vec)[0]

    probability = model.predict_proba(text_vec)[0][0]

    return {
        "prediction": int(prediction),
        "fake_probability": float(probability)
    }