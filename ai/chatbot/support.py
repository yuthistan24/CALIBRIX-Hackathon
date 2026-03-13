import random

from sentiment.engine import analyze_sentiment


CHAT_TOPICS = {
    "academic": {
        "label": "coursework pressure",
        "keywords": ["study", "studies", "exam", "assignment", "deadline", "grade", "class", "course", "fail"],
        "strategies": [
            "Pick the smallest academic task you can finish in 10 minutes.",
            "Break one deadline into three visible sub-steps and start the first one only.",
            "Send one concrete question to a lecturer, tutor, or classmate today.",
        ],
        "questions": [
            "Which academic task feels most stuck right now?",
            "What is the smallest study action you could complete in the next 15 minutes?",
            "Is the pressure coming more from workload, fear of failure, or concentration?",
        ],
    },
    "emotional": {
        "label": "emotional strain",
        "keywords": ["sad", "down", "cry", "empty", "hopeless", "heavy", "upset", "depressed"],
        "strategies": [
            "Name the feeling directly and rate its intensity from 1 to 10.",
            "Take a slow 4-4-6 breathing cycle for two minutes.",
            "Stay with one grounding detail you can see, hear, and feel right now.",
        ],
        "questions": [
            "Did this feeling build gradually today or hit suddenly?",
            "What triggered the heaviest part of this emotion?",
            "Would it help to focus first on calming your body or organizing the problem?",
        ],
    },
    "anxiety": {
        "label": "anxiety and worry",
        "keywords": ["anxious", "panic", "worried", "worry", "nervous", "fear", "afraid", "overthinking"],
        "strategies": [
            "Write down the worst-case thought and one more realistic alternative.",
            "Slow your breathing and unclench your shoulders before the next task.",
            "Reduce the next decision to one immediate step instead of the whole problem.",
        ],
        "questions": [
            "What thought keeps looping the most right now?",
            "Is your anxiety more about performance, relationships, or uncertainty?",
            "What would make the next hour feel 10 percent safer?",
        ],
    },
    "social": {
        "label": "belonging and connection",
        "keywords": ["alone", "lonely", "friend", "friends", "family", "ignored", "isolated", "belong"],
        "strategies": [
            "Message one trusted person with a simple honest check-in.",
            "Choose one low-pressure social contact instead of waiting for energy to appear.",
            "Write down one place or person that feels safest to approach.",
        ],
        "questions": [
            "Are you feeling more disconnected from friends, family, or campus life?",
            "Who feels safest to contact, even briefly?",
            "Did something specific happen today that made you feel left out?",
        ],
    },
    "family": {
        "label": "family pressure",
        "keywords": ["home", "family", "parents", "mother", "father", "house", "conflict"],
        "strategies": [
            "Protect one short study block away from conflict if possible.",
            "Write one sentence you can use to ask for space or support calmly.",
            "Separate what is under your control tonight from what is not.",
        ],
        "questions": [
            "Is the hardest part expectation, conflict, or lack of support?",
            "What boundary would make today feel slightly more manageable?",
            "Do you need help planning around the home situation or talking about the feelings from it?",
        ],
    },
    "sleep": {
        "label": "sleep and energy strain",
        "keywords": ["sleep", "slept", "tired", "exhausted", "energy", "fatigue"],
        "strategies": [
            "Lower the difficulty of your next task to match today's energy instead of forcing full intensity.",
            "Plan one recovery break before starting anything mentally heavy.",
            "Avoid stacking multiple demanding tasks without a pause today.",
        ],
        "questions": [
            "Is low energy affecting concentration, mood, or both?",
            "What task can be simplified instead of postponed completely?",
            "Do you want help making a low-energy study plan for today?",
        ],
    },
}


def pick_variant(options):
    if not options:
        return ""
    return random.choice(options)


def infer_topic(message, dominant_risk=""):
    lowered = str(message or "").lower()
    for topic, config in CHAT_TOPICS.items():
        if any(keyword in lowered for keyword in config["keywords"]):
            return topic
    return "emotional"


def generate_support_reply(payload):
    message = payload.get("message", "")
    normalized = str(message or "").strip().lower()
    normalized = "".join(character for character in normalized if character.isalnum() or character.isspace()).strip()
    greetings = {
        "hi",
        "hello",
        "hey",
        "hii",
        "hiii",
        "yo",
        "good morning",
        "good afternoon",
        "good evening",
        "namaste",
    }
    if normalized in greetings:
        steps = [
            "In one sentence, tell me what you want help with (stress, studies, loneliness, sleep, motivation).",
            "Pick a starting area: stress / studies / loneliness / sleep / motivation.",
            "Rate it from 1 to 10 right now.",
        ]
        follow_up = "What would you like help with right now?"
        return {
            "reply": f"Hi. 1) {steps[0]} 2) {steps[1]} 3) {steps[2]} Question: {follow_up}",
            "copingStrategies": steps,
            "escalate": False,
            "topic": "check-in",
            "followUpQuestion": follow_up,
            "alertSeverity": "low",
            "escalationReason": "",
        }
    if normalized in greetings:
        steps = [
            "Pick one topic: studies / stress / loneliness / sleep / motivation.",
            "Tell me what’s happening in 1–2 sentences.",
            "Tell me what you want by the end of this chat (calm down / plan / talk it out / resources).",
        ]
        follow_up = "Which topic should we start with?"
        return {
            "reply": f"Hi — quick start: 1) {steps[0]} 2) {steps[1]} 3) {steps[2]} Question: {follow_up}",
            "copingStrategies": steps,
            "escalate": False,
            "topic": "check-in",
            "followUpQuestion": follow_up,
            "alertSeverity": "low",
            "escalationReason": "",
        }

    student_context = payload.get("studentContext", {})
    student_context = {}
    topic = infer_topic(message, student_context.get("dominantRisk", ""))
    config = CHAT_TOPICS[topic]
    sentiment = analyze_sentiment(message)
    history = payload.get("chatHistory", [])
    history = []
    assistant_turns = sum(1 for entry in history if entry.get("role") == "assistant")
    assistant_turns = 0

    if student_context.get("latestCheckinRisk") == "High concern":
        context_note = "Your latest daily check-in also suggests today has been especially heavy."
    elif student_context.get("dropoutRisk") == "High risk":
        context_note = "Given your recent risk pattern, it is worth keeping the next step very small and specific."
    else:
        context_note = ""

    if assistant_turns == 0:
        follow_up = pick_variant(config["questions"])
    elif assistant_turns == 1:
        follow_up = f"On a scale from 1 to 10, how intense is this {config['label']} right now?"
    else:
        follow_up = f"What is one realistic action you could take in the next hour to reduce this {config['label']} a little?"

    strategies = list(config.get("strategies") or [])[:4]
    steps_text = " ".join(f"{index + 1}) {step}" for index, step in enumerate(strategies[:3]))
    reply_parts = [
        context_note,
        f"Try: {steps_text}" if steps_text else "",
        f"Question: {follow_up}",
    ]
    reply = " ".join(part for part in reply_parts if part)

    return {
        "reply": reply,
        "copingStrategies": strategies,
        "escalate": sentiment["stressIndicator"] >= 0.7 or student_context.get("latestCheckinRisk") == "High concern",
        "topic": config["label"],
        "followUpQuestion": follow_up,
        "alertSeverity": "high" if sentiment["stressIndicator"] >= 0.82 else "moderate" if sentiment["label"] == "Negative" else "low",
        "escalationReason": (
            "Strong distress language or stress signals were detected in the latest student message."
            if sentiment["stressIndicator"] >= 0.7
            else ""
        ),
    }
