import os
import re
import certifi

# Fix for macOS SSL Certificate errors - MUST be before other imports
os.environ['SSL_CERT_FILE'] = certifi.where()

import asyncio
import logging
import json
import time
import threading
from pathlib import Path
from dotenv import load_dotenv

from livekit import agents, api
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
    noise_cancellation,
    sarvam,
    google,
    silero,
)
from livekit.agents import llm
from typing import Optional

# Load environment variables
load_dotenv(".env")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("outbound-agent")

import config
from gemini_classifier import classify_transcript, save_classification
from odoo_client import OdooClient

# -------------------------------------------------------------------
# Transcript helpers
# -------------------------------------------------------------------

def _transcript_path(phone_number: str) -> Path:
    folder = Path("transcripts")
    folder.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    safe = (phone_number or "unknown").replace("+", "").replace(" ", "")
    return folder / f"{safe}_{ts}.txt"


def _save_transcript(phone_number: str, lines: list, lead_name: str = ""):
    if not lines:
        logger.info("No transcript lines to save.")
        return
    path = _transcript_path(phone_number)
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"Call Transcript\n")
        f.write(f"Number : {phone_number}\n")
        if lead_name:
            f.write(f"Name   : {lead_name}\n")
        f.write(f"Time   : {ts}\n")
        f.write("=" * 50 + "\n\n")
        for line in lines:
            f.write(line + "\n")
    logger.info(f"Transcript saved -> {path}")
    # Kick off Gemini classification + Odoo push in a background daemon thread
    threading.Thread(
        target=_classify_and_push,
        args=(phone_number, lead_name, list(lines), path),
        daemon=True,
    ).start()


def _classify_and_push(phone_number: str, lead_name: str, lines: list, transcript_path):
    """Background thread: classify transcript with Gemini then push to Odoo CRM."""
    try:
        logger.info(f"[Post-call] Classifying transcript for {phone_number}")
        data = classify_transcript(lines, phone_number)
        save_classification(transcript_path, data)
        OdooClient().push_call(phone_number, lead_name, lines, data)
        logger.info(f"[Post-call] Done for {phone_number} — {data.get('classification')}")
    except Exception as e:
        logger.error(f"[Post-call] Failed for {phone_number}: {e}", exc_info=True)


# -------------------------------------------------------------------
# TTS / LLM builders
# -------------------------------------------------------------------

def _build_tts(config_provider: str = None, config_voice: str = None):
    provider = (config_provider or os.getenv("TTS_PROVIDER", config.DEFAULT_TTS_PROVIDER)).lower()

    if config_voice in ["anushka", "kavya", "shreya", "neha", "simran", "suhani", "aravind", "amartya", "dhruv"]:
        provider = "sarvam"

    if provider == "cartesia":
        logger.info("Using Cartesia TTS")
        return cartesia.TTS(
            model=os.getenv("CARTESIA_TTS_MODEL", config.CARTESIA_MODEL),
            voice=os.getenv("CARTESIA_TTS_VOICE", config.CARTESIA_VOICE),
        )

    if provider == "sarvam":
        logger.info(f"Using Sarvam TTS (Voice: {config_voice})")
        voice = config_voice or os.getenv("SARVAM_VOICE", "anushka")
        return sarvam.TTS(
            model=os.getenv("SARVAM_TTS_MODEL", config.SARVAM_MODEL),
            speaker=voice,
            target_language_code=os.getenv("SARVAM_LANGUAGE", config.SARVAM_LANGUAGE),
        )

    if provider == "deepgram":
        logger.info("Using Deepgram TTS")
        return deepgram.TTS(model=os.getenv("DEEPGRAM_TTS_MODEL", "aura-asteria-en"))

    logger.info(f"Using OpenAI TTS (Voice: {config_voice})")
    voice = config_voice or os.getenv("OPENAI_TTS_VOICE", config.DEFAULT_TTS_VOICE)
    return openai.TTS(model=os.getenv("OPENAI_TTS_MODEL", "tts-1"), voice=voice)


def _build_llm(config_provider: str = None):
    provider = (config_provider or os.getenv("LLM_PROVIDER", config.DEFAULT_LLM_PROVIDER)).lower()

    if provider == "gemini":
        logger.info("Using Gemini LLM")
        return google.LLM(
            model=os.getenv("GEMINI_MODEL", config.GEMINI_MODEL),
            api_key=os.getenv("GEMINI_API_KEY"),
        )

    if provider == "groq":
        logger.info("Using Groq LLM")
        return openai.LLM(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.getenv("GROQ_API_KEY"),
            model=os.getenv("GROQ_MODEL", config.GROQ_MODEL),
            temperature=float(os.getenv("GROQ_TEMPERATURE", str(config.GROQ_TEMPERATURE))),
        )

    logger.info("Using OpenAI LLM")
    return openai.LLM(model=config.DEFAULT_LLM_MODEL)


# -------------------------------------------------------------------
# Tool context
# -------------------------------------------------------------------

class TransferFunctions(llm.ToolContext):
    def __init__(self, ctx: agents.JobContext, phone_number: str = None, transcript: list = None, lead_name: str = ""):
        super().__init__(tools=[])
        self.ctx = ctx
        self.phone_number = phone_number
        self.transcript = transcript if transcript is not None else []
        self.lead_name = lead_name

    @llm.function_tool(description="End and disconnect the call when the conversation is complete or the customer wants to hang up.")
    async def end_call(self):
        """Gracefully end the current call and save the transcript."""
        # Guard: only allow end_call if the closing phrase has already been delivered,
        # OR if it's an early exit (customer not interested). This prevents the LLM
        # from hanging up before confirming the city and saying the closing line.
        closing_phrase = "Our team will review your requirement and connect with you shortly"
        early_exit_phrase = "No problem at all"
        transcript_text = " ".join(self.transcript)
        already_said_closing = closing_phrase in transcript_text or early_exit_phrase in transcript_text

        if not already_said_closing:
            logger.info("end_call called but closing phrase not yet delivered — blocking premature hang-up.")
            return "Say the closing phrase first, then the call will end automatically."

        logger.info("Agent ending the call.")
        _save_transcript(self.phone_number, self.transcript, self.lead_name)

        try:
            if self.phone_number:
                participant_identity = f"sip_{self.phone_number}"
            else:
                participant_identity = None
                for p in self.ctx.room.remote_participants.values():
                    participant_identity = p.identity
                    break

            if participant_identity:
                await self.ctx.api.room.remove_participant(
                    api.RoomParticipantIdentity(
                        room=self.ctx.room.name,
                        identity=participant_identity,
                    )
                )
        except Exception as e:
            logger.warning(f"Could not remove SIP participant cleanly: {e}")
        finally:
            self.ctx.shutdown()
        return "Call ended."

    @llm.function_tool(description="Transfer the call to a human support agent or another phone number.")
    async def transfer_call(self, destination: Optional[str] = None):
        """Transfer the call."""
        if destination is None:
            destination = config.DEFAULT_TRANSFER_NUMBER
            if not destination:
                return "Error: No default transfer number configured."
        if "@" not in destination:
            if config.SIP_DOMAIN:
                clean_dest = destination.replace("tel:", "").replace("sip:", "")
                destination = f"sip:{clean_dest}@{config.SIP_DOMAIN}"
            else:
                if not destination.startswith("tel:") and not destination.startswith("sip:"):
                    destination = f"tel:{destination}"
        elif not destination.startswith("sip:"):
            destination = f"sip:{destination}"

        logger.info(f"Transferring call to {destination}")

        participant_identity = None
        if self.phone_number:
            participant_identity = f"sip_{self.phone_number}"
        else:
            for p in self.ctx.room.remote_participants.values():
                participant_identity = p.identity
                break

        if not participant_identity:
            logger.error("Could not determine participant identity for transfer")
            return "Failed to transfer: could not identify the caller."

        try:
            await self.ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=self.ctx.room.name,
                    participant_identity=participant_identity,
                    transfer_to=destination,
                    play_dialtone=False,
                )
            )
            return "Transfer initiated successfully."
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            return f"Error executing transfer: {e}"


# -------------------------------------------------------------------
# Agent
# -------------------------------------------------------------------

class OutboundAssistant(Agent):
    def __init__(self, tools: list) -> None:
        super().__init__(
            instructions=config.SYSTEM_PROMPT,
            tools=tools,
        )


# -------------------------------------------------------------------
# Entrypoint
# -------------------------------------------------------------------

async def entrypoint(ctx: agents.JobContext):
    logger.info(f"Connecting to room: {ctx.room.name}")

    phone_number = None
    config_dict = {}

    try:
        if ctx.job.metadata:
            data = json.loads(ctx.job.metadata)
            phone_number = data.get("phone_number")
            config_dict = data
    except Exception:
        pass

    try:
        if ctx.room.metadata:
            data = json.loads(ctx.room.metadata)
            if data.get("phone_number"):
                phone_number = data.get("phone_number")
            config_dict.update(data)
    except Exception:
        logger.warning("No valid JSON metadata found in Room.")

    lead_name = config_dict.get("leadName", config_dict.get("lead_name", ""))

    # Shared list that both the event handlers and end_call() write to
    transcript = []
    closing_triggered = False
    city_confirmed = False      # True once customer confirms the city (Q6 done)
    last_agent_had_correct = False  # True when last agent turn ended with "correct?"

    async def _force_end_after_closing():
        nonlocal closing_triggered
        if closing_triggered:
            return
        closing_triggered = True
        logger.info("Closing phrase detected — force-ending call in 5s.")
        await asyncio.sleep(5)
        _save_transcript(phone_number, transcript, lead_name)
        try:
            identity = f"sip_{phone_number}" if phone_number else None
            if not identity:
                for p in ctx.room.remote_participants.values():
                    identity = p.identity
                    break
            if identity:
                await ctx.api.room.remove_participant(
                    api.RoomParticipantIdentity(room=ctx.room.name, identity=identity)
                )
        except Exception as e:
            logger.warning(f"Force-end: could not remove SIP participant: {e}")
        finally:
            ctx.shutdown()

    async def _force_closing_and_end():
        """Inject closing phrase then end — used when LLM skips it after city confirmed."""
        nonlocal closing_triggered
        if closing_triggered:
            return
        closing_triggered = True
        logger.info("City confirmed but no closing phrase — injecting closing and ending in 8s.")
        await asyncio.sleep(1)
        try:
            await session.generate_reply(
                instructions='Say EXACTLY this and nothing else: "Perfect, thank you for sharing the details. Our team will review your requirement and connect with you shortly. Have a great day!"'
            )
        except Exception as e:
            logger.warning(f"Force-closing: generate_reply failed: {e}")
        await asyncio.sleep(7)
        _save_transcript(phone_number, transcript, lead_name)
        try:
            identity = f"sip_{phone_number}" if phone_number else None
            if not identity:
                for p in ctx.room.remote_participants.values():
                    identity = p.identity
                    break
            if identity:
                await ctx.api.room.remove_participant(
                    api.RoomParticipantIdentity(room=ctx.room.name, identity=identity)
                )
        except Exception as e:
            logger.warning(f"Force-closing: could not remove SIP participant: {e}")
        finally:
            ctx.shutdown()

    fnc_ctx = TransferFunctions(ctx, phone_number, transcript, lead_name)

    session = AgentSession(
        stt=sarvam.STT(
            model=config.STT_MODEL,
            language=config.STT_LANGUAGE,
            mode=config.STT_MODE,
        ),
        llm=_build_llm(config_dict.get("model_provider")),
        tts=_build_tts(config_dict.get("model_provider"), config_dict.get("voice_id")),
        vad=silero.VAD.load(),              # real-time voice detection — instant barge-in
        # Barge-in: stop the moment customer speaks, never resume
        allow_interruptions=True,
        min_interruption_duration=0.2,      # stop after 0.2s of customer speech
        min_interruption_words=0,           # audio alone triggers stop, no word count needed
        resume_false_interruption=False,    # once stopped, do NOT resume
        false_interruption_timeout=None,    # disable false-interruption detection
        min_endpointing_delay=0.8,          # wait 0.8s after customer stops before responding
        max_endpointing_delay=6.0,
    )

    # --- Capture conversation turns ---
    @session.on("user_input_transcribed")
    def on_user_transcribed(ev):
        nonlocal city_confirmed
        try:
            text = ev.transcript if isinstance(ev.transcript, str) else getattr(ev, "text", str(ev))
            if text.strip():
                transcript.append(f"[Customer]: {text.strip()}")
                logger.info(f"[Customer]: {text.strip()}")

                # Detect city confirmation: agent asked "correct?" and customer affirms
                if last_agent_had_correct and not city_confirmed and not closing_triggered:
                    affirmatives = {"yes", "yeah", "yep", "correct", "right", "sure", "ok", "okay",
                                    "haan", "ha", "han", "bilkul", "sahi", "ya", "yaa", "हाँ", "हां", "सही"}
                    customer_words = set(text.strip().lower().replace(".", "").replace(",", "").split())
                    if customer_words & affirmatives:
                        city_confirmed = True
                        logger.info("City confirmed by customer — scheduling force-closing check.")
                        asyncio.ensure_future(_city_confirmed_watchdog())
        except Exception:
            pass

    async def _city_confirmed_watchdog():
        """Wait 4s after city confirmed; if closing phrase not triggered, force inject it."""
        await asyncio.sleep(4)
        if not closing_triggered:
            logger.info("LLM did not say closing phrase after city confirmed — force injecting.")
            asyncio.ensure_future(_force_closing_and_end())

    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        nonlocal last_agent_had_correct
        try:
            msg = ev.item
            if msg.role == "assistant":
                content = msg.content
                if isinstance(content, list):
                    text = " ".join(
                        c.text if hasattr(c, "text") else str(c)
                        for c in content if c
                    )
                else:
                    text = str(content) if content else ""
                # Strip function call markup e.g. <function=end_call></function>
                text = re.sub(r'<function=[^>]*>.*?</function>', '', text, flags=re.DOTALL)
                text = re.sub(r'<function=[^>]*/?>', '', text)
                text = text.strip()
                if text:
                    transcript.append(f"[Anushka]: {text}")
                    # Track if agent just asked for city confirmation ("correct?")
                    last_agent_had_correct = "correct?" in text.lower()
                    # Force-end whenever closing phrase is spoken, regardless of LLM tool call
                    if "Our team will review your requirement and connect with you shortly" in text:
                        asyncio.ensure_future(_force_end_after_closing())
        except Exception:
            pass

    # Backup: save transcript when room disconnects (covers cases where end_call wasn't called)
    @ctx.room.on("disconnected")
    def on_room_disconnected():
        if transcript:
            _save_transcript(phone_number, transcript, lead_name)

    await session.start(
        room=ctx.room,
        agent=OutboundAssistant(tools=list(fnc_ctx.function_tools.values())),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVCTelephony(),
            close_on_disconnect=True,
        ),
    )

    should_dial = False
    if phone_number:
        user_already_here = False
        for p in ctx.room.remote_participants.values():
            if f"sip_{phone_number}" in p.identity or "sip_" in p.identity:
                user_already_here = True
                break

        if not user_already_here:
            should_dial = True
            logger.info("User not in room. Agent will initiate dial-out.")
        else:
            logger.info("User already in room (Dashboard dispatched).")

    if should_dial:
        logger.info(f"Initiating outbound SIP call to {phone_number}...")
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=config.SIP_TRUNK_ID,
                    sip_call_to=phone_number,
                    participant_identity=f"sip_{phone_number}",
                    wait_until_answered=True,
                )
            )
            logger.info("Call answered! Agent is now listening.")
            await session.generate_reply(instructions=config.INITIAL_GREETING)
        except Exception as e:
            logger.error(f"Failed to place outbound call: {e}")
            ctx.shutdown()
    else:
        logger.info("Detecting if we should greet...")
        await session.generate_reply(instructions=config.fallback_greeting)


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="outbound-caller",
        )
    )
