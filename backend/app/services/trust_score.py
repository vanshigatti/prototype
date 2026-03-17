def calculate_trust_score(fake_probability, sensational_score):

    score = 100

    score -= fake_probability * 50
    score -= sensational_score * 10

    if score < 0:
        score = 0

    return round(score)