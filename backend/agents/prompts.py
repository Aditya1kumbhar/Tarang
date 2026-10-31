"""
Multilingual System Prompts, Script Detectors and Deterministic Synthesis Templates for ORCA.
Supports Indian coastal languages: Tamil (ta), Malayalam (ml), Telugu (te), Kannada (kn),
Marathi (mr), Gujarati (gu), Odia (or), Bengali (bn), Hindi (hi), and English (en).
Strictly enforces evidence citations and deterministic safety overrides without emojis.
"""

from typing import Dict, Optional

# ==============================================================================
# 1. LANGUAGE AND SCRIPT DETECTION
# ==============================================================================

SCRIPT_RANGES = {
    "ta": (0x0B80, 0x0BFF),  # Tamil
    "ml": (0x0D00, 0x0D7F),  # Malayalam
    "te": (0x0C00, 0x0C7F),  # Telugu
    "kn": (0x0C80, 0x0CFF),  # Kannada
    "gu": (0x0A80, 0x0AFF),  # Gujarati
    "or": (0x0B00, 0x0B7F),  # Odia
    "bn": (0x0980, 0x09FF),  # Bengali
    "devanagari": (0x0900, 0x097F),  # Hindi / Marathi
}

MARATHI_KEYWORDS = [
    "मासे", "बंदर", "वारा", "लाटा", "सांग", "आहेत", "का", "बोट", "सागरी",
    "मालवण", "ससून", "मुंबई", "कोकण", "जाऊ", "येईल"
]


def detect_language(text: str, default_lang: str = "en") -> str:
    """
    Detects language based on Unicode script block analysis and regional vocabulary.
    """
    if not text or not text.strip():
        return default_lang

    counts: Dict[str, int] = {k: 0 for k in SCRIPT_RANGES}
    for char in text:
        cp = ord(char)
        for lang, (start, end) in SCRIPT_RANGES.items():
            if start <= cp <= end:
                counts[lang] += 1
                break

    best_lang = max(counts, key=counts.get)
    if counts[best_lang] > 0:
        if best_lang == "devanagari":
            lower_text = text.lower()
            if any(kw in lower_text for kw in MARATHI_KEYWORDS):
                return "mr"
            return "hi"
        return best_lang

    lower = text.lower()
    if any(w in lower for w in ["vanakkam", "meen", "padagu", "kaatru", "alai"]):
        return "ta"
    if any(w in lower for w in ["meenpiditham", "kadal", "vallam", "thirakal"]):
        return "ml"

    return default_lang


# ==============================================================================
# 2. LOCALIZED SAFETY OVERRIDE BANNERS (CLEAN TEXT, NO EMOJIS)
# ==============================================================================

SAFETY_OVERRIDE_BANNERS = {
    "RED_ALERT": {
        "en": "CRITICAL MARITIME SAFETY OVERRIDE: DO NOT VENTURE / IMMEDIATE COURSE CORRECTION REQUIRED",
        "ta": "அவசர கடல்சார் பாதுகாப்பு எச்சரிக்கை: கடலுக்குச் செல்ல வேண்டாம் / உடனடி திசை திருப்புதல் தேவை",
        "ml": "അടിയന്തര സമുദ്ര സുരക്ഷാ മുന്നറിയിപ്പ്: കടലിൽ പോകരുത് / ഉടൻ തിരിച്ചുപോവുക",
        "te": "అత్యవసర సముద్ర భద్రతా హెచ్చరిక: సముద్రంలోకి వెళ్లవద్దు / తక్షణమే దిశ మార్చుకోండి",
        "kn": "ತುರ್ತು ಸಾಗರ ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ: ಸಮುದ್ರಕ್ಕೆ ಇಳಿಯಬೇಡಿ / ತಕ್ಷಣವೇ ಹಿಂತಿರುಗಿ",
        "mr": "तात्काळ सागरी सुरक्षा चेतावणी: समुद्रात जाऊ नका / तात्काळ मार्ग बदल आवश्यक",
        "gu": "કટોકટી સમુદ્રી સુરક્ષા ચેતવણી: દરિયામાં જશો નહીં / તાત્કાલિક પાછા ફરો",
        "hi": "आपातकालीन समुद्री सुरक्षा चेतावनी: समुद्र में न जाएं / तत्काल मार्ग सुधार आवश्यक",
        "or": "ଜରୁରୀ ସାମୁଦ୍ରିକ ସୁରକ୍ଷା ଚେତାବନୀ: ସମୁଦ୍ରକୁ ଯାଆନ୍ତୁ ନାହିଁ / ତୁରନ୍ତ ଫେରିଆସନ୍ତୁ",
        "bn": "জরুরি সামুদ্রিক সুরক্ষা সতর্কতা: সমুদ্রে যাবেন না / অবিলম্বে কোর্স পরিবর্তন প্রয়োজন",
    },
    "AMBER": {
        "en": "MARITIME CAUTION ADVISORY: Heightened sea conditions or approaching maritime border buffer.",
        "ta": "கடல்சார் எச்சரிக்கை அறிவுரை: கடல் சீற்றம் அல்லது எல்லை இடையக பகுதி அணுகல்.",
        "ml": "സമുദ്ര ജാഗ്രതാ നിർദ്ദേശം: പ്രക്ഷുബ്ധമായ കടൽാവസ്ഥ അല്ലെങ്കിൽ അതിർത്തി ബഫർ സോൺ.",
        "te": "సముద్ర హెచ్చరిక సలహా: పెరిగిన అలలు లేదా సరిహద్దు బఫర్ ప్రాంతం.",
        "kn": "ಸಾಗರ ಎಚ್ಚರಿಕೆಯ ಸಲಹೆ: ಪ್ರಕ್ಷುಬ್ಧ ಸಮುದ್ರ ಅಥವಾ ಗಡಿ ಬಫರ್ ವಲಯ ಸಮೀಪದಲ್ಲಿದೆ.",
        "mr": "सागरी खबरदारी सूचना: वाढलेली लाटांची स्थिती किंवा सीमा बफर क्षेत्र.",
        "gu": "સમુદ્રી સાવચેતી સલાહ: દરિયાઈ સ્થિતિ જોખમી અથવા સરહદ બફર વિસ્તાર નજીક.",
        "hi": "समुद्री सावधानी सलाह: समुद्र की तेज लहरें या सीमा बफर क्षेत्र के निकट.",
        "or": "ସାମୁଦ୍ରିକ ସତର୍କତା ପରାମର୍ଶ: ଅଶାନ୍ତ ସମୁଦ୍ର କିମ୍ବା ସୀମା ବଫର ଅଞ୍ଚଳ ନିକଟବର୍ତ୍ତୀ.",
        "bn": "সামুদ্রিক সতর্কতা পরামর্শ: প্রতিকূল সমুদ্রাবস্থা বা সামুদ্রিক সীমান্ত বাফারের নিকটবর্তী।",
    },
}


def get_safety_override_banner(safety_status: str, lang: str) -> Optional[str]:
    banners = SAFETY_OVERRIDE_BANNERS.get(safety_status)
    if not banners:
        return None
    return banners.get(lang, banners.get("en"))



