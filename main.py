import os
import logging
import xmlrpc.client
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
import google.generativeai as genai
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
ODOO_URL = os.environ.get("ODOO_URL", "https://imperio2.odoo.com")
ODOO_DB = os.environ.get("ODOO_DB", "imperio2")
ODOO_USERNAME = os.environ.get("ODOO_USERNAME", "dm@imperiorailing.com")
ODOO_API_KEY = os.environ.get("ODOO_API_KEY", "")

if GEMINI_API_KEY:
      genai.configure(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = (
      "You are Priya, an AI voice assistant from Imperio Railing Systems. "
      "Your job is to professionally qualify leads who came from Meta Ads for premium glass railing solutions. "
      "Start exactly with: Hello, I am Priya from Imperio Railing Systems. You recently showed interest in our glass railing solutions, so I just wanted to understand your requirement better. "
      "Then ask these questions one at a time: "
      "1) buyer_type - Are you a builder, architect, or for personal home? Options: Personal Home, Builder, Developer, Architect, Interior Designer, Commercial. "
      "2) requirement_type - What kind of railing? Balcony, staircase, terrace, or other? "
      "3) project_stage - Is the project under construction, renovation, or at finishing stage? "
      "4) quantity_requirement - How much railing? Small, Medium, Full Home, or Large Project? "
      "5) urgency_level - By when? Immediate, Within 1 month, 2-3 months, 6+ months, Just Exploring? "
      "6) project_location - Which city? "
      "After all answers say: Perfect, thank you for sharing the details. Our team will review your requirement and connect with you shortly. "
      "Keep responses short. Ask one question at a time. Sound professional like a premium consultant."
)

sessions = {}


def get_gemini_response(session_id, user_input):
      try:
                if session_id not in sessions:
                              sessions[session_id] = []
                          model = genai.GenerativeModel("gemini-1.5-flash")
                chat = model.start_chat(history=sessions[session_id])
                full_input = (SYSTEM_PROMPT + " User: " + user_input) if not sessions[session_id] else user_input
                response = chat.send_message(full_input)
                sessions[session_id] = chat.history
                return response.text.strip()
except Exception as e:
        logger.error(f"Gemini error: {e}")
        return "Hello, I am Priya from Imperio Railing Systems. How can I help you?"


def save_to_odoo(data, phone=""):
      try:
                common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
                uid = common.authenticate(ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {})
                if not uid:
                              return False
                          models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
                lead_vals = {
                    "name": f"Voice Lead - {phone or 'Unknown'}",
                    "description": str(data),
                    "phone": phone,
                    "partner_name": f"Lead {phone}",
                }
                lead_id = models.execute_kw(ODOO_DB, uid, ODOO_API_KEY, "crm.lead", "create", [lead_vals])
                logger.info(f"Created Odoo lead: {lead_id}")
                return True
except Exception as e:
        logger.error(f"Odoo error: {e}")
        return False


@app.get("/")
async def health():
      return {"status": "Priya Voice Bot running", "service": "Imperio Railing Systems"}


@app.post("/webhook")
@app.post("/vobiz")
async def webhook(request: Request):
      try:
                form_data = await request.form()
                call_sid = str(form_data.get("CallSid", form_data.get("call_sid", "unknown")))
                caller = str(form_data.get("From", form_data.get("caller", "")))
                speech = str(form_data.get("SpeechResult", form_data.get("speech", "")))
                logger.info(f"Call {call_sid} from {caller}: '{speech}'")

          if not speech or speech == "None":
                        response_text = "Hello, I am Priya from Imperio Railing Systems. You recently showed interest in our glass railing solutions. Are you a builder, architect, or looking for your personal home?"
else:
            response_text = get_gemini_response(call_sid, speech)

        end_kw = ["thank you for sharing", "connect with you shortly", "our team will review"]
        is_ending = any(k in response_text.lower() for k in end_kw)

        if is_ending and call_sid in sessions:
                      save_to_odoo({"caller": caller, "session": call_sid}, caller)
                      del sessions[call_sid]

        if is_ending:
                      xml = f"""<?xml version="1.0" encoding="UTF-8"?>
                      <Response>
                          <Say voice="woman" language="en-IN">{response_text}</Say>
                              <Hangup/>
                              </Response>"""
else:
            xml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="woman" language="en-IN">{response_text}</Say>
                    <Gather input="speech" timeout="5" speechTimeout="auto" action="/webhook" method="POST">
                            <Say voice="woman" language="en-IN">Please go ahead.</Say>
                                </Gather>
                                </Response>"""

        return PlainTextResponse(content=xml, media_type="application/xml")
except Exception as e:
        logger.error(f"Webhook error: {e}")
        return PlainTextResponse(
                      content='<?xml version="1.0"?><Response><Say>Please hold.</Say><Hangup/></Response>',
                      media_type="application/xml",
        )


@app.post("/lead")
async def create_lead(request: Request):
      try:
                data = await request.json()
                ok = save_to_odoo(data, data.get("phone", ""))
                return {"success": ok}
except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
      port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
