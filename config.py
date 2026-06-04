import os
from dotenv import load_dotenv

load_dotenv()

# =========================================================================================
#  🤖 RAPID X AI - AGENT CONFIGURATION
#  Use this file to customize your agent's personality, models, and behavior.
# =========================================================================================

# --- 1. AGENT PERSONA & PROMPTS ---
# The main instructions for the AI. Defines who it is and how it behaves.
SYSTEM_PROMPT = """
You are Anushka, an AI voice assistant from Imperio Railing Systems.
Your job is to professionally qualify leads who came from Meta Ads for premium glass railing solutions.

VOICE & TONE:
- Sound natural, premium, confident, friendly, conversational
- Speak slightly faster than normal — sharp, clear, efficient
- Keep sentences short. No over-explaining. No long pauses.
- Sound like a smart premium sales consultant, NOT a slow customer support agent

ABSOLUTE RULES — NEVER BREAK THESE:
- NEVER add internal notes, commentary, or parenthetical remarks in your speech. Never say things like "(Note: ...)" or "(Since the customer said...)" — speak only what the customer will hear.
- NEVER skip any of the 6 questions for any reason whatsoever
- NEVER move to the next question until the current one has a real, direct answer
- NEVER end the call without first saying the closing phrase word-for-word
- NEVER suggest answers to the customer or tell them what to say
- NEVER discuss pricing, quotations, availability, or product details — say "I'll pass that along" and redirect
- NEVER switch to Hindi unless triggered by the rules below

GOAL: Collect ALL 6 details by asking ONE question at a time, IN ORDER:
1. buyer_type
2. requirement_type
3. project_stage
4. quantity_requirement
5. urgency_level
6. project_location

WHAT COUNTS AS A REAL ANSWER (move to next question only when this is met):

Q1 — buyer_type: Must be one of: homeowner / builder / developer / architect / interior designer.
  - If answer is unclear, vague, or off-topic (e.g. "बहुत acceptable", "okay", "yes"), re-ask: "Just to confirm — are you buying this for your own home, or are you a builder, developer, architect, or interior designer?"

Q2 — requirement_type: Must be a type of railing location: balcony / staircase / terrace / other specific area.
  - Accept any reasonable railing location. If completely unclear, re-ask.

Q3 — project_stage: Must be one of: under construction / renovation / finishing stage.
  - If customer gives context ("my home is 3 years old, want to change") — that means RENOVATION. Accept it and move on.
  - NEVER skip this question. ALWAYS ask it between Q2 and Q4.

Q4 — quantity_requirement: Must be an approximate amount — meters, running feet, number of floors/balconies/units, or any quantity indicator.
  - Accept any quantity format: "3 railings", "50 meters", "15 balconies", "2 floors" — all valid.
  - If customer asks for quotation instead of answering: say "Sure, I'll pass that along. Approximately how much railing work would you need?" — SAME question again.
  - NEVER skip this question even if customer goes off-topic.

Q5 — urgency_level: Must be a timeframe: "1 week", "next month", "3 months", "ASAP", etc.
  - If customer switches language instead of answering, ask the same question in the new language.
  - NEVER skip this question.

Q6 — project_location: Must be a real city or area name in India.
  - If customer gives a non-city answer (a person's name, a country, "Sri Lanka", etc.) — say "I didn't quite catch the city name. Which city in India is the project located in?"
  - If customer gives two conflicting city names — say "Just to confirm, is the project in [first city] or [second city]?"
  - NEVER accept a country name, person's name, or unclear answer as the city.
  - Once a valid city is given, confirm: "Got it, so that's [city] — correct?"
  - Once confirmed — go DIRECTLY to STEP A below.

CLOSING SEQUENCE (after city confirmed — THIS IS MANDATORY):
STEP A — Say EXACTLY this line, word for word, no changes:
"Perfect, thank you for sharing the details. Our team will review your requirement and connect with you shortly. Have a great day!"

STEP B — Immediately after saying that line, call the end_call function.

EARLY EXIT — If customer is clearly not interested, says stop, or says goodbye:
Say: "No problem at all. Have a great day!" then call end_call.

REDIRECT RULE — when customer goes off-topic:
1. Briefly acknowledge: "Sure, I'll note that." / "Got it."
2. Ask the EXACT SAME question again — do NOT advance to the next question.
Example: Q4 asked → customer asks for quotation → "Sure, I'll pass that along. Approximately how much railing work would you need?" (Q4 again)
Example: Q5 asked → customer switches language → ask Q5 in the new language.

LANGUAGE RULE:
- Default language: English always.
- Switch to Hindi (and stay in Hindi for ALL remaining questions) ONLY if:
  1. Customer explicitly asks: "Hindi mein baat karo", "speak Hindi", "can we speak Hindi", "Hindi mein bolo", etc.
  2. Customer gives a full answer where ALL or nearly ALL words are Hindi — a complete Hindi sentence with no English words (e.g., "अगले महीने तक करना है", "मुझे नहीं पता").
- Do NOT switch for ANY of these — stay in English:
  - Mixed answers like "बालकनी railing", "मुझे staircase चाहिए", "हम 30 balconies", "finishing stage पे", "under construction है"
  - Single Hindi words like "हाँ", "ठीक है", "नहीं"
  - Answers that contain even one English word
- Once in Hindi (triggered by rule 1 or 2 above), stay in Hindi for all remaining questions.

LISTENING & RESPONDING:
- When the customer starts speaking, STOP talking immediately and listen to their full reply.
- NEVER talk over the customer. If they speak mid-sentence, stop and let them finish.
- Only respond AFTER the customer has fully finished speaking.
- Once you have their complete answer, acknowledge it briefly, then ask the next question.
- If their answer is vague or unclear — ask ONE short clarifying question, then move on.
- Never over-explain or give long responses.

LEAD SCORING (internal only, never mention to customer):
- HOT: Builder/Developer + immediate urgency + large quantity + under construction
- WARM: Medium urgency + medium quantity
- COLD: Just exploring + low urgency + unclear requirement

ONLY use transfer_call if customer explicitly asks to speak to a human.
"""

INITIAL_GREETING = "The user has picked up. Start immediately with: Hello, I am Anushka from Imperio Railing Systems. You recently showed interest in our glass railing solutions, so I just wanted to understand your requirement better. Then ask the first question."

fallback_greeting = "Greet the user as Anushka from Imperio Railing Systems and begin the qualification flow immediately."


# --- 2. SPEECH-TO-TEXT (STT) SETTINGS ---
STT_PROVIDER = "sarvam"
STT_MODEL = "saaras:v3"   # Best Sarvam model — handles Indian accents and Hindi natively
STT_LANGUAGE = "hi-IN"    # Use hi-IN so codemix mode handles Hindi + English switching
STT_MODE = "codemix"      # Handles customers who switch between Hindi and English mid-sentence

# Keyword boosting — biases Deepgram toward these words during transcription.
# Format: "word:boost" where boost 1–10 (higher = stronger preference).
DEEPGRAM_KEYWORDS = [
    # --- Maharashtra ---
    "Mumbai:2", "Pune:2", "Nagpur:2", "Nashik:2", "Aurangabad:2", "Solapur:2",
    "Kolhapur:2", "Thane:2", "Navi Mumbai:2", "Vasai:2", "Virar:2", "Kalyan:2",
    "Dombivli:2", "Ulhasnagar:2", "Bhiwandi:2", "Panvel:2", "Raigad:2",
    "Alibag:2", "Lonavala:2", "Khandala:2", "Mahabaleshwar:2", "Satara:2",
    "Sangli:2", "Latur:2", "Amravati:2", "Akola:2", "Jalgaon:2", "Dhule:2",
    # Mumbai localities
    "Andheri:2", "Bandra:2", "Borivali:2", "Kandivali:2", "Malad:2",
    "Goregaon:2", "Jogeshwari:2", "Vile Parle:2", "Santacruz:2", "Khar:2",
    "Dadar:2", "Worli:2", "Lower Parel:2", "Prabhadevi:2", "Mahim:2",
    "Kurla:2", "Ghatkopar:2", "Vikhroli:2", "Mulund:2", "Bhandup:2",
    "Powai:2", "Chembur:2", "Mankhurd:2", "Govandi:2", "Trombay:2",
    "Colaba:2", "Churchgate:2", "Fort:2", "Nariman Point:2", "Cuffe Parade:2",
    "Wadala:2", "Sion:2", "Chunabhatti:2", "Matunga:2", "Parel:2",
    "Dharavi:2", "Koliwada:2", "Versova:2", "Juhu:2", "Lokhandwala:2",
    "Oshiwara:2", "Dahisar:2", "Mira Road:2", "Bhayandar:2",
    # --- Delhi NCR ---
    "Delhi:2", "New Delhi:2", "Noida:2", "Gurgaon:2", "Gurugram:2",
    "Faridabad:2", "Ghaziabad:2", "Greater Noida:2", "Dwarka:2",
    "Rohini:2", "Pitampura:2", "Janakpuri:2", "Lajpat Nagar:2",
    "Saket:2", "Vasant Kunj:2", "Mayur Vihar:2", "Preet Vihar:2",
    "Shahdara:2", "Connaught Place:2", "Karol Bagh:2", "Paharganj:2",
    "South Extension:2", "Defence Colony:2", "Greater Kailash:2",
    # --- Karnataka ---
    "Bangalore:2", "Bengaluru:2", "Mysore:2", "Mysuru:2", "Hubli:2",
    "Dharwad:2", "Mangalore:2", "Mangaluru:2", "Belgaum:2", "Belagavi:2",
    "Gulbarga:2", "Kalaburagi:2", "Shimoga:2", "Shivamogga:2",
    "Tumkur:2", "Davangere:2", "Bellary:2", "Ballari:2", "Hassan:2",
    "Udupi:2", "Manipal:2", "Whitefield:2", "Electronic City:2",
    "Koramangala:2", "Indiranagar:2", "Jayanagar:2", "Marathahalli:2",
    "Hebbal:2", "Yelahanka:2", "Bannerghatta:2", "Sarjapur:2",
    # --- Tamil Nadu ---
    "Chennai:2", "Coimbatore:2", "Madurai:2", "Tiruchirappalli:2",
    "Trichy:2", "Salem:2", "Tirunelveli:2", "Tiruppur:2", "Vellore:2",
    "Erode:2", "Thanjavur:2", "Dindigul:2", "Nagercoil:2", "Kanchipuram:2",
    "Cuddalore:2", "Kumbakonam:2", "Hosur:2", "Anna Nagar:2",
    "T Nagar:2", "Adyar:2", "Velachery:2", "Tambaram:2", "Porur:2",
    # --- Telangana & Andhra Pradesh ---
    "Hyderabad:2", "Secunderabad:2", "Warangal:2", "Nizamabad:2",
    "Karimnagar:2", "Khammam:2", "Mahbubnagar:2", "Nalgonda:2",
    "Visakhapatnam:2", "Vizag:2", "Vijayawada:2", "Guntur:2",
    "Nellore:2", "Kurnool:2", "Kakinada:2", "Tirupati:2", "Rajahmundry:2",
    "Gachibowli:2", "Hitech City:2", "Madhapur:2", "Kukatpally:2",
    "Banjara Hills:2", "Jubilee Hills:2", "Miyapur:2", "Kondapur:2",
    # --- Gujarat ---
    "Ahmedabad:2", "Surat:2", "Vadodara:2", "Baroda:2", "Rajkot:2",
    "Bhavnagar:2", "Jamnagar:2", "Gandhinagar:2", "Anand:2", "Nadiad:2",
    "Bharuch:2", "Morbi:2", "Junagadh:2", "Mehsana:2", "Surendranagar:2",
    "Porbandar:2", "Navsari:2", "Valsad:2", "Amreli:2", "Bhuj:2",
    # --- Rajasthan ---
    "Jaipur:2", "Jodhpur:2", "Udaipur:2", "Kota:2", "Ajmer:2",
    "Bikaner:2", "Bharatpur:2", "Alwar:2", "Sikar:2", "Pali:2",
    "Bhilwara:2", "Sri Ganganagar:2", "Jhunjhunu:2", "Chittorgarh:2",
    # --- Uttar Pradesh ---
    "Lucknow:2", "Kanpur:2", "Agra:2", "Varanasi:2", "Allahabad:2",
    "Prayagraj:2", "Meerut:2", "Ghaziabad:2", "Bareilly:2", "Aligarh:2",
    "Moradabad:2", "Saharanpur:2", "Gorakhpur:2", "Firozabad:2",
    "Mathura:2", "Vrindavan:2", "Jhansi:2", "Muzaffarnagar:2",
    "Hapur:2", "Etawah:2", "Rampur:2", "Shahjahanpur:2",
    # --- Madhya Pradesh ---
    "Indore:2", "Bhopal:2", "Jabalpur:2", "Gwalior:2", "Ujjain:2",
    "Sagar:2", "Dewas:2", "Satna:2", "Ratlam:2", "Rewa:2",
    "Murwara:2", "Singrauli:2", "Burhanpur:2", "Khandwa:2",
    # --- West Bengal ---
    "Kolkata:2", "Calcutta:2", "Howrah:2", "Durgapur:2", "Asansol:2",
    "Siliguri:2", "Bardhaman:2", "Burdwan:2", "Malda:2", "Krishnanagar:2",
    "Haldia:2", "Kharagpur:2", "Baharampur:2", "Raiganj:2",
    "Salt Lake:2", "New Town:2", "Rajarhat:2", "Dum Dum:2",
    # --- Punjab & Haryana ---
    "Chandigarh:2", "Ludhiana:2", "Amritsar:2", "Jalandhar:2",
    "Patiala:2", "Bathinda:2", "Mohali:2", "Hoshiarpur:2",
    "Ambala:2", "Karnal:2", "Panipat:2", "Sonipat:2", "Rohtak:2",
    "Hisar:2", "Yamunanagar:2", "Bhiwani:2", "Rewari:2",
    # --- Bihar & Jharkhand ---
    "Patna:2", "Gaya:2", "Bhagalpur:2", "Muzaffarpur:2", "Purnia:2",
    "Darbhanga:2", "Arrah:2", "Begusarai:2", "Katihar:2",
    "Ranchi:2", "Jamshedpur:2", "Dhanbad:2", "Bokaro:2", "Deoghar:2",
    "Hazaribagh:2", "Giridih:2", "Ramgarh:2",
    # --- Odisha ---
    "Bhubaneswar:2", "Cuttack:2", "Rourkela:2", "Brahmapur:2",
    "Sambalpur:2", "Puri:2", "Balasore:2", "Bhadrak:2",
    # --- Kerala ---
    "Kochi:2", "Cochin:2", "Thiruvananthapuram:2", "Trivandrum:2",
    "Kozhikode:2", "Calicut:2", "Thrissur:2", "Kollam:2",
    "Palakkad:2", "Alappuzha:2", "Kannur:2", "Kottayam:2",
    "Malappuram:2", "Ernakulam:2",
    # --- Goa ---
    "Panaji:2", "Margao:2", "Vasco:2", "Mapusa:2", "Ponda:2",
    # --- Himachal & Uttarakhand ---
    "Shimla:2", "Manali:2", "Dharamsala:2", "Solan:2", "Mandi:2",
    "Dehradun:2", "Haridwar:2", "Rishikesh:2", "Nainital:2", "Roorkee:2",
    # --- Northeast ---
    "Guwahati:2", "Shillong:2", "Agartala:2", "Imphal:2",
    "Aizawl:2", "Kohima:2", "Itanagar:2", "Dibrugarh:2",
    # --- Jammu & Kashmir ---
    "Srinagar:2", "Jammu:2", "Leh:2",
]


# --- 3. TEXT-TO-SPEECH (TTS) SETTINGS ---
# Choose your voice provider: "openai", "sarvam" (Indian voices), or "cartesia" (Ultra-fast)
DEFAULT_TTS_PROVIDER = "sarvam"
DEFAULT_TTS_VOICE = "kavya"

# Sarvam AI Specifics (for Indian Context)
SARVAM_MODEL = "bulbul:v3-beta"
SARVAM_LANGUAGE = "en-IN" # or hi-IN

# Cartesia Specifics
CARTESIA_MODEL = "sonic-2"
CARTESIA_VOICE = "f786b574-daa5-4673-aa0c-cbe3e8534c02"


# --- 4. LARGE LANGUAGE MODEL (LLM) SETTINGS ---
# Choose "openai", "groq", or "gemini"
DEFAULT_LLM_PROVIDER = "gemini"
DEFAULT_LLM_MODEL = "gpt-4o-mini"  # OpenAI fallback

# Gemini Specifics
GEMINI_MODEL = "gemini-2.5-flash"

# Groq Specifics (Faster inference)
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_TEMPERATURE = 0.7


# --- 5. TELEPHONY & TRANSFERS ---
# Default number to transfer calls to if no specific destination is asked.
DEFAULT_TRANSFER_NUMBER = os.getenv("DEFAULT_TRANSFER_NUMBER")

# Vobiz Trunk Details (Loaded from .env usually, but you can hardcode if needed)
SIP_TRUNK_ID = os.getenv("VOBIZ_SIP_TRUNK_ID")
SIP_DOMAIN = os.getenv("VOBIZ_SIP_DOMAIN")
