import json
import os
import urllib.request
import urllib.error
import logging
from pathlib import Path

logger = logging.getLogger("gemini-classifier")

_PROMPT = """You are a sales lead qualification expert for Imperio Railing Systems, an Indian railing and balustrade company.

Analyze this AI voice sales call transcript and classify the lead quality.

TRANSCRIPT:
{transcript}

CLASSIFICATION CRITERIA:
- Hot: Customer clearly interested, gave specific requirements (type, quantity, timeline, location), expects follow-up soon
- Warm: Customer engaged but non-committal — vague requirements, "call later", "thinking about it", or partial info given
- Cold: Not interested, wrong number, no response, hung up early, or nuisance call

Return ONLY valid JSON with NO markdown fences, no explanation, exactly this structure:
{{
  "classification": "Hot",
  "confidence": "high",
  "reason": "Customer confirmed 40m staircase railing for under-construction building in Mumbai within 2 months",
  "key_points": ["40 meters staircase railing", "Mumbai", "2 month timeline", "builder segment"],
  "follow_up_priority": "immediate",
  "buyer_type": "builder",
  "requirement": "staircase railing",
  "location": "Mumbai",
  "urgency": "2 months"
}}

Valid values:
- classification: "Hot" | "Warm" | "Cold"
- confidence: "high" | "medium" | "low"
- follow_up_priority: "immediate" | "within_week" | "low_priority"
- All other string fields: extracted value or null
"""


def classify_transcript(transcript_lines: list, phone_number: str = "") -> dict:
    """Call Gemini API to classify a call transcript as Hot, Warm, or Cold."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping classification")
        return _unknown("GEMINI_API_KEY not configured")

    transcript_text = "\n".join(transcript_lines).strip()
    if not transcript_text:
        return {
            "classification": "Cold",
            "confidence": "high",
            "reason": "No conversation recorded — call not answered or empty transcript",
            "key_points": [],
            "follow_up_priority": "low_priority",
        }

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    payload = json.dumps({
        "contents": [{"parts": [{"text": _PROMPT.format(transcript=transcript_text)}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512},
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Strip markdown code fences if Gemini wrapped the JSON
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)
        logger.info(
            f"[{phone_number}] Classified as: {data.get('classification')} "
            f"({data.get('confidence')}) — {data.get('reason', '')[:80]}"
        )
        return data

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Gemini HTTP {e.code} for {phone_number}: {body[:300]}")
        return _unknown(f"Gemini API error {e.code}")
    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned non-JSON for {phone_number}: {e}")
        return _unknown("Gemini response was not valid JSON")
    except Exception as e:
        logger.error(f"Gemini classification failed for {phone_number}: {e}")
        return _unknown(str(e))


def _unknown(reason: str) -> dict:
    return {
        "classification": "Unknown",
        "confidence": "low",
        "reason": reason,
        "key_points": [],
        "follow_up_priority": "low_priority",
    }


def save_classification(transcript_path, data: dict) -> Path:
    """Save classification result as a .json sidecar next to the .txt transcript."""
    json_path = Path(transcript_path).with_suffix(".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logger.info(f"Classification saved -> {json_path}")
    return json_path
