import os
import requests

API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
headers = {
    "Authorization": f"Bearer {os.environ['HF_TOKEN']}",
}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()

def detect_text_classification(text):
    output = query({
        "inputs": text,
        "parameters": {"candidate_labels": ["educational content","personal data",
            "credentials","sensitive information","entertainment","other"]},
    })

    print(output)
    labels = output.get("labels", [])
    scores = output.get("scores", [])

    if not labels or not scores:
        return False

    max_index = scores.index(max(scores))
    top_label = labels[max_index]

    return top_label == "educational content"