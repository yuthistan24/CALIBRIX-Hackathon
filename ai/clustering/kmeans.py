import math


SECTION_ORDER = ["A", "B", "C", "D", "E"]
RISK_LABELS = {
    0: (1, "Emotional distress dominant", "Emotional Distress"),
    1: (2, "Academic helplessness", "Academic Helplessness"),
    2: (4, "Social belonging issues", "Social Belonging Issues"),
    3: (3, "Family stress dominant", "Family Stress Dominant"),
    4: (5, "Coping resilience deficit", "Coping Resilience Deficit"),
}


REFERENCE_PROFILES = [
    [46, 18, 20, 24, 18],
    [44, 16, 18, 22, 20],
    [42, 22, 22, 24, 20],
    [20, 46, 26, 24, 28],
    [18, 44, 22, 20, 24],
    [22, 42, 18, 26, 26],
    [24, 22, 46, 24, 26],
    [20, 24, 44, 22, 28],
    [22, 20, 42, 24, 30],
    [26, 22, 24, 46, 22],
    [24, 20, 22, 44, 24],
    [28, 24, 20, 42, 26],
    [22, 24, 28, 20, 46],
    [18, 20, 24, 22, 44],
    [20, 22, 26, 24, 42],
]


def vectorize(section_scores):
    return [float(section_scores[key]) for key in SECTION_ORDER]


def euclidean_distance(left, right):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def mean_vector(points):
    if not points:
        return [0.0] * len(SECTION_ORDER)
    return [sum(values) / len(values) for values in zip(*points)]


def nearest_centroid(point, centroids):
    distances = [euclidean_distance(point, centroid) for centroid in centroids]
    return min(range(len(distances)), key=distances.__getitem__), distances


def run_kmeans(points, iterations=15):
    centroids = [profile[:] for profile in REFERENCE_PROFILES[:5]]

    for _ in range(iterations):
        buckets = [[] for _ in centroids]
        for point in points:
            centroid_index, _ = nearest_centroid(point, centroids)
            buckets[centroid_index].append(point)

        next_centroids = []
        for index, bucket in enumerate(buckets):
            next_centroids.append(mean_vector(bucket) if bucket else centroids[index])

        if next_centroids == centroids:
            break
        centroids = next_centroids

    assignments = [nearest_centroid(point, centroids)[0] for point in points]
    return centroids, assignments


def cluster_student(section_scores):
    student_vector = vectorize(section_scores)
    dataset = REFERENCE_PROFILES + [student_vector]
    centroids, assignments = run_kmeans(dataset)
    cluster_index = assignments[-1]
    centroid = centroids[cluster_index]
    dominant_dimension = max(range(len(centroid)), key=centroid.__getitem__)
    cluster_id, cluster_label, dominant_factor = RISK_LABELS[dominant_dimension]

    ranked_factors = [
        {"factor": RISK_LABELS[index][2], "score": float(score)}
        for index, score in sorted(enumerate(student_vector), key=lambda item: item[1], reverse=True)
    ]
    centroid_distances = [round(euclidean_distance(student_vector, current), 2) for current in centroids]

    return {
        "clusterId": cluster_id,
        "clusterLabel": cluster_label,
        "dominantFactor": dominant_factor,
        "rankedFactors": ranked_factors,
        "centroidDistances": centroid_distances,
    }
