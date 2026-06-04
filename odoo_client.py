"""
Odoo CRM integration via XML-RPC.
Uses only Python built-ins — no new dependencies required.

Required environment variables (set in .env when ready):
    ODOO_URL        e.g. https://yourcompany.odoo.com
    ODOO_DB         database name shown in Settings → General Settings
    ODOO_USERNAME   your Odoo login email
    ODOO_API_KEY    generated in Settings → Technical → API Keys
"""

import xmlrpc.client
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("odoo-client")

# Odoo color index for CRM tags
_TAG_COLORS = {"Hot": 1, "Warm": 3, "Cold": 4, "Unknown": 0}
_CLASSIFICATION_TAG_NAMES = ["Hot Lead", "Warm Lead", "Cold Lead", "Unknown Lead"]


class OdooClient:
    def __init__(self):
        # XML-RPC lives at the root domain, not /odoo — strip that suffix if present
        self.url = os.getenv("ODOO_URL", "").rstrip("/").removesuffix("/odoo")
        self.db = os.getenv("ODOO_DB", "")
        self.username = os.getenv("ODOO_USERNAME", "")
        self.api_key = os.getenv("ODOO_API_KEY", "")
        self._uid = None

    # ── Configuration check ───────────────────────────────────────────────────

    def is_configured(self) -> bool:
        return bool(self.url and self.db and self.username and self.api_key)

    # ── XML-RPC helpers ───────────────────────────────────────────────────────

    def _authenticate(self) -> int:
        if self._uid:
            return self._uid
        common = xmlrpc.client.ServerProxy(
            f"{self.url}/xmlrpc/2/common", allow_none=True
        )
        uid = common.authenticate(self.db, self.username, self.api_key, {})
        if not uid:
            raise ValueError(
                "Odoo authentication failed — check ODOO_URL / ODOO_DB / "
                "ODOO_USERNAME / ODOO_API_KEY"
            )
        self._uid = uid
        logger.info(f"Authenticated to Odoo (uid={uid})")
        return uid

    def _exec(self, model: str, method: str, args: list, kwargs: dict = None):
        uid = self._authenticate()
        models = xmlrpc.client.ServerProxy(
            f"{self.url}/xmlrpc/2/object", allow_none=True
        )
        return models.execute_kw(
            self.db, uid, self.api_key, model, method, args, kwargs or {}
        )

    # ── CRM tags ──────────────────────────────────────────────────────────────

    def _get_or_create_tag(self, classification: str) -> int:
        """Return the id of the 'Hot Lead' / 'Warm Lead' / 'Cold Lead' tag, creating it if needed."""
        tag_name = f"{classification} Lead"
        existing = self._exec(
            "crm.lead.tag", "search_read",
            [[["name", "=", tag_name]]],
            {"fields": ["id"], "limit": 1},
        )
        if existing:
            return existing[0]["id"]
        tag_id = self._exec("crm.lead.tag", "create", [{
            "name": tag_name,
            "color": _TAG_COLORS.get(classification, 0),
        }])
        logger.info(f"Created Odoo CRM tag: '{tag_name}' (id={tag_id})")
        return tag_id

    def _classification_tag_ids(self) -> list:
        """Return IDs of all classification tags so we can remove them before setting a new one."""
        tags = self._exec(
            "crm.lead.tag", "search_read",
            [[["name", "in", _CLASSIFICATION_TAG_NAMES]]],
            {"fields": ["id"]},
        )
        return [t["id"] for t in tags]

    # ── CRM leads ─────────────────────────────────────────────────────────────

    def find_lead_by_phone(self, phone: str):
        """Return existing lead id matched by last 10 digits of phone, or None."""
        suffix = phone.replace("+", "").replace(" ", "").replace("-", "")[-10:]
        leads = self._exec(
            "crm.lead", "search_read",
            [[["phone", "like", suffix]]],
            {"fields": ["id", "name", "phone"], "limit": 1},
        )
        return leads[0]["id"] if leads else None

    def create_lead(self, name: str, phone: str, classification: str, reason: str = "") -> int:
        tag_id = self._get_or_create_tag(classification)
        lead_id = self._exec("crm.lead", "create", [{
            "name": f"{name} — {phone}" if name else phone,
            "phone": phone,
            "description": reason,
            "tag_ids": [[4, tag_id]],
            "type": "lead",
        }])
        logger.info(f"Created Odoo lead #{lead_id} for {phone} [{classification}]")
        return lead_id

    def update_lead_classification(self, lead_id: int, classification: str):
        """Remove all existing classification tags and set the new one."""
        old_ids = self._classification_tag_ids()
        new_id = self._get_or_create_tag(classification)
        cmds = [[3, tid] for tid in old_ids] + [[4, new_id]]
        self._exec("crm.lead", "write", [[lead_id], {"tag_ids": cmds}])
        logger.info(f"Updated Odoo lead #{lead_id} → {classification}")

    # ── Chatter note ──────────────────────────────────────────────────────────

    def post_transcript_note(
        self,
        lead_id: int,
        phone: str,
        transcript_lines: list,
        classification_data: dict,
    ):
        """Post the full transcript + AI classification as a chatter note on the CRM lead."""
        c = classification_data.get("classification", "Unknown")
        reason = classification_data.get("reason", "")
        key_points = classification_data.get("key_points") or []
        follow_up = (classification_data.get("follow_up_priority") or "").replace("_", " ").title()
        buyer = classification_data.get("buyer_type") or ""
        requirement = classification_data.get("requirement") or ""
        location = classification_data.get("location") or ""
        urgency = classification_data.get("urgency") or ""

        color_map = {"Hot": "#ef4444", "Warm": "#f59e0b", "Cold": "#3b82f6"}
        badge_color = color_map.get(c, "#6b7280")

        transcript_html = "\n".join(transcript_lines).replace("<", "&lt;").replace(">", "&gt;")

        kp_html = (
            "<p><strong>Key Points:</strong><br/>"
            + "<br/>".join(f"• {p}" for p in key_points)
            + "</p>"
        ) if key_points else ""

        details_rows = "".join(
            f"<tr><td style='padding:2px 12px 2px 0;color:#6b7280'>{k}</td><td><strong>{v}</strong></td></tr>"
            for k, v in [
                ("Buyer Type", buyer), ("Requirement", requirement),
                ("Location", location), ("Urgency", urgency),
                ("Follow-up", follow_up),
            ] if v
        )
        details_html = (
            f"<table style='margin:8px 0;font-size:13px'>{details_rows}</table>"
            if details_rows else ""
        )

        body = f"""
<div style="font-family:sans-serif;font-size:13px;line-height:1.6">
  <h3 style="margin:0 0 10px;font-size:15px">📞 AI Voice Call — Imperio Railing Systems</h3>
  <p style="margin:4px 0"><strong>Phone:</strong> {phone}</p>
  <p style="margin:4px 0"><strong>AI Classification:</strong>&nbsp;
    <span style="background:{badge_color};color:#fff;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:700">
      {c} Lead
    </span>
  </p>
  <p style="margin:6px 0 2px"><strong>Reason:</strong> {reason}</p>
  {details_html}
  {kp_html}
  <hr style="margin:14px 0;border:none;border-top:1px solid #e5e7eb"/>
  <h4 style="margin:0 0 8px;font-size:13px">Full Transcript</h4>
  <pre style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px;
              font-size:12px;white-space:pre-wrap;line-height:1.6;margin:0">{transcript_html}</pre>
</div>
"""
        self._exec("crm.lead", "message_post", [[lead_id]], {
            "body": body,
            "message_type": "comment",
            "subtype_xmlid": "mail.mt_note",
        })
        logger.info(f"Transcript note posted to Odoo lead #{lead_id}")

    # ── Main entry point ──────────────────────────────────────────────────────

    def push_call(
        self,
        phone: str,
        lead_name: str,
        transcript_lines: list,
        classification_data: dict,
    ):
        """
        Full CRM push flow:
          1. Find existing lead by phone OR create new one
          2. Set Hot/Warm/Cold classification tag
          3. Post transcript + AI summary as chatter note

        Returns the Odoo lead_id, or None if Odoo is not configured or an error occurs.
        """
        if not self.is_configured():
            logger.info(
                "Odoo not configured — set ODOO_URL / ODOO_DB / ODOO_USERNAME / "
                "ODOO_API_KEY in .env to enable CRM push"
            )
            return None

        try:
            classification = classification_data.get("classification", "Unknown")
            lead_id = self.find_lead_by_phone(phone)

            if lead_id:
                logger.info(f"Found existing Odoo lead #{lead_id} for {phone}")
                self.update_lead_classification(lead_id, classification)
            else:
                lead_id = self.create_lead(
                    name=lead_name,
                    phone=phone,
                    classification=classification,
                    reason=classification_data.get("reason", ""),
                )

            self.post_transcript_note(lead_id, phone, transcript_lines, classification_data)
            logger.info(f"CRM push complete: {phone} → Odoo lead #{lead_id} [{classification}]")
            return lead_id

        except Exception as e:
            logger.error(f"Odoo push failed for {phone}: {e}", exc_info=True)
            return None
