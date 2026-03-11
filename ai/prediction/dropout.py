import math


def sigmoid(value):
    return 1 / (1 + math.exp(-value))


def predict_dropout(payload):
    total_normalized = float(payload.get("totalScore", 0)) / 250.0
    sentiment_penalty = max(0.0, -float(payload.get("sentimentScore", 0)))
    historical_engagement = float(payload.get("historicalEngagement", 0.6))
    completion_pattern = float(payload.get("assessmentCompletionPatterns", 0.8))
    section_scores = payload.get("sectionScores", {})
    peak_section = max((float(value) for value in section_scores.values()), default=0.0) / 50.0

    linear_score = (
        total_normalized * 2.3
        + sentiment_penalty * 1.6
        + (1 - historical_engagement) * 1.1
        + (1 - completion_pattern) * 0.9
        + peak_section * 1.2
        - 2.6
    )

    probability = sigmoid(linear_score)
    if probability >= 0.75:
        risk_level = "High risk"
    elif probability >= 0.45:
        risk_level = "Medium risk"
    else:
        risk_level = "Low risk"

    return {
        "probability": round(probability, 4),
        "riskLevel": risk_level,
    }
