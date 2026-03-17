import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib

fake = pd.read_csv("datasets/Fake.csv")
real = pd.read_csv("datasets/True.csv")

fake["label"] = 0
real["label"] = 1

data = pd.concat([fake, real])

X = data["text"]
y = data["label"]

vectorizer = TfidfVectorizer(stop_words="english")

X_vec = vectorizer.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X_vec, y, test_size=0.2
)

model = LogisticRegression()
model.fit(X_train, y_train)

joblib.dump(model, "models/fake_news_model.pkl")
joblib.dump(vectorizer, "models/vectorizer.pkl")

print("Model trained successfully")