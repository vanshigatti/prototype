from nltk.sentiment import SentimentIntensityAnalyzer

# initialize sentiment analyzer
sia = SentimentIntensityAnalyzer()

sensational_words = [
    "shocking",
    "secret",
    "miracle",
    "exposed",
    "government hiding",
    "doctors hate"
]


def detect_sensational_language(text):

    score = 0

    for word in sensational_words:
        if word in text.lower():
            score += 1

    return score


def detect_emotion(text):

    sentiment = sia.polarity_scores(text)

    compound = sentiment["compound"]

    if compound >= 0.5:
        emotion = "positive"

    elif compound <= -0.5:
        emotion = "fear/anger"

    else:
        emotion = "neutral"

    return {
        "emotion": emotion,
        "sentiment_score": compound
    }