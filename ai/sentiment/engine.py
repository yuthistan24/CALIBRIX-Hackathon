POSITIVE_WORDS = {
    "calm",
    "hopeful",
    "better",
    "good",
    "supported",
    "strong",
    "relaxed",
    "steady",
    "safe",
}

NEGATIVE_WORDS = {
    "sad",
    "anxious",
    "hopeless",
    "stressed",
    "overwhelmed",
    "tired",
    "panic",
    "afraid",
    "fail",
    "failing",
}

STRESS_WORDS = {
    "dropout",
    "worthless",
    "alone",
    "panic",
    "crying",
    "suicide",
    "hurt",
    "trapped",
}


def tokenize(message):
    current = []
    for character in message.lower():
        if character.isalpha():
            current.append(character)
        elif current:
            yield "".join(current)
            current = []
    if current:
        yield "".join(current)


def analyze_sentiment(message):
    tokens = list(tokenize(message))
    positive_count = sum(1 for token in tokens if token in POSITIVE_WORDS)
    negative_count = sum(1 for token in tokens if token in NEGATIVE_WORDS)
    stress_count = sum(1 for token in tokens if token in STRESS_WORDS)
    denominator = max(len(tokens), 4)

    raw_score = (positive_count - negative_count - stress_count * 1.5) / denominator
    score = max(-1.0, min(1.0, raw_score * 5))
    stress_indicator = min(1.0, (negative_count + stress_count * 2) / denominator)

    if score > 0.2:
        label = "Positive"
    elif score < -0.2:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "score": round(score, 4),
        "label": label,
        "stressIndicator": round(stress_indicator, 4),
    }
