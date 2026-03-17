from fastapi import APIRouter
from app.services.model_service import predict_fake_news
from app.services.emotion_detector import detect_emotion, detect_sensational_language
from app.services.language_detector import detect_language
from app.services.trust_score import calculate_trust_score


router = APIRouter()

@router.post("/analyze")
def analyze_text(data: dict):

    text = data["text"]

    language = detect_language(text)

    model_result = predict_fake_news(text)

    sensational_score = detect_sensational_language(text)

    emotion_result = detect_emotion(text)

    trust = calculate_trust_score(
        model_result["fake_probability"],
        sensational_score
    )

    return {
        "language": language,
        "fake_probability": model_result["fake_probability"],
        "emotion": emotion_result["emotion"],
        "sentiment_score": emotion_result["sentiment_score"],
        "sensational_score": sensational_score,
        "trust_score": trust
    }