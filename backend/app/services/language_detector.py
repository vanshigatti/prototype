from langdetect import detect

def detect_language(text):

    try:
        lang = detect(text)
    except:
        lang = "unknown"

    language_map = {
        "en": "English",
        "hi": "Hindi",
        "mr": "Marathi",
        "ta": "Tamil"
    }

    return language_map.get(lang, lang)