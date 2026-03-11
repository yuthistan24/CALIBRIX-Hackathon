from sentiment.engine import analyze_sentiment


COPING_LIBRARY = {
    "Emotional Distress": [
        "Try a 4-4-6 breathing cycle for two minutes.",
        "Write down the strongest feeling and what triggered it.",
        "Reduce the next task to one small action you can finish in 10 minutes.",
    ],
    "Academic Helplessness": [
        "Pick one assignment and divide it into three tiny steps.",
        "Message a teacher or peer with one concrete academic question.",
        "Use a 25 minute focus sprint and then pause.",
    ],
    "Social Belonging Issues": [
        "Reach out to one trusted peer or mentor today.",
        "Attend one group activity or online class discussion this week.",
        "List one place on campus where you feel safest.",
    ],
    "Family Stress Dominant": [
        "Schedule a protected study block away from conflict if possible.",
        "Name one boundary you need this week.",
        "Write one sentence you can use to ask for support calmly.",
    ],
    "Coping Resilience Deficit": [
        "Choose one grounding exercise before your next study session.",
        "Plan a short recovery routine for the end of today.",
        "Track one success, even if it feels small.",
    ],
}


def generate_support_reply(payload):
    message = payload.get("message", "")
    student_context = payload.get("studentContext", {})
    dominant_risk = student_context.get("dominantRisk", "Emotional Distress")
    sentiment = analyze_sentiment(message)
    strategies = COPING_LIBRARY.get(dominant_risk, COPING_LIBRARY["Emotional Distress"])

    if sentiment["label"] == "Negative":
        lead = "It sounds like this is weighing on you."
    elif sentiment["label"] == "Positive":
        lead = "I can hear some strength in what you shared."
    else:
        lead = "Thank you for saying that clearly."

    reply = (
        f"{lead} Which part feels most urgent right now: emotions, coursework, belonging, family pressure, or coping?"
    )

    return {
        "reply": reply,
        "copingStrategies": strategies,
        "escalate": sentiment["stressIndicator"] >= 0.7,
    }
