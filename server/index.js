import express from "express";
import cors from "cors";
import { initializeDatabase, pool } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT || 4000);
const whatsappVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "autoparts_verify_token";
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const twilioContentSid = process.env.TWILIO_CONTENT_SID || "";
const twilioTrialMode = process.env.TWILIO_TRIAL_MODE !== "false";
const communicationClients = new Set();
const pendingWhatsAppReplies = new Map();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

function inventoryStatusFromStock(stock) {
  const stockCount = Number(stock || 0);
  if (stockCount <= 0) return "Out of Stock";
  if (stockCount <= 2) return "Low Stock";
  if (stockCount <= 3) return "Limited";
  return "Available";
}

function leadFromBody(body, id) {
  return {
    id: id || body.id || Date.now(),
    customer: body.customer,
    contact: body.contact,
    stage: body.stage || "Enquiry",
    followup: body.followup || "Today",
    value: Number(body.value || 0),
    month: body.month || "Sep",
    phone: body.phone || "",
    email: body.email || "",
    color: body.color || "",
    budget: body.budget || "Under 5K",
    paymentType: body.paymentType || "Cash",
    source: body.source || "Walk-in",
    notes: body.notes || ""
  };
}

function carFromBody(body, id) {
  const stock = Number(body.stock || 0);

  return {
    id: id || body.id || Date.now(),
    model: body.model,
    variant: body.variant,
    price: Number(body.price || 0),
    stock,
    colors: body.colors || "",
    status: inventoryStatusFromStock(stock)
  };
}

function communicationFromBody(body, id) {
  return {
    id: id || body.id || Date.now(),
    enquiryId: Number(body.enquiryId),
    customer: body.customer || "",
    component: body.component || "",
    channel: body.channel || "Gmail",
    message: body.message || "",
    nextAction: body.nextAction || "Follow-up saved",
    createdAt: body.createdAt || new Date().toISOString()
  };
}

function extractWhatsAppMessage(body) {
  if (body.From || body.Body) {
    return {
      phone: body.From || "",
      message: body.Body || ""
    };
  }

  if (body.phone || body.message) {
    return {
      phone: body.phone || "",
      message: body.message || ""
    };
  }

  const change = body.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  const contact = change?.contacts?.[0];

  if (!message) {
    return { phone: "", message: "" };
  }

  const text =
    message.text?.body ||
    message.button?.text ||
    message.interactive?.button_reply?.title ||
    message.interactive?.list_reply?.title ||
    `[${message.type || "message"} received]`;

  return {
    phone: message.from || contact?.wa_id || "",
    message: text
  };
}

function formatWhatsAppNumber(value = "") {
  if (value.startsWith("whatsapp:")) {
    return value;
  }

  const digits = normalizePhone(value);
  if (!digits) {
    return "";
  }

  const phoneWithCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `whatsapp:+${phoneWithCountryCode}`;
}

function escapeXml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isTwilioWebhook(body) {
  return Boolean(body.From || body.Body || body.MessageSid);
}

function broadcastCommunication(communication) {
  const payload = `event: communication\ndata: ${JSON.stringify(communication)}\n\n`;

  communicationClients.forEach((client) => {
    client.write(payload);
  });
}

async function findDuplicateLead(lead) {
  const [rows] = await pool.query("SELECT id, customer, contact, phone, email FROM component_enquiries WHERE id <> ?", [lead.id]);
  const phone = normalizePhone(lead.phone);
  const email = normalizeEmail(lead.email);

  return rows.find((row) => {
    const samePhone = phone && normalizePhone(row.phone || "") === phone;
    const sameEmail = email && normalizeEmail(row.email || "") === email;
    return samePhone || sameEmail;
  });
}

async function findOrCreateWhatsAppEnquiry(phone) {
  const normalizedPhone = normalizePhone(phone);
  const [enquiries] = await pool.query("SELECT * FROM component_enquiries ORDER BY id DESC");
  const existingEnquiry = enquiries.find((item) => normalizePhone(item.phone || "").endsWith(normalizedPhone.slice(-10)));

  if (existingEnquiry || !normalizedPhone) {
    return existingEnquiry;
  }

  const demoEnquiry = {
    id: Date.now(),
    customer: `WhatsApp Demo ${normalizedPhone.slice(-4)}`,
    contact: "Twilio Live Chat",
    stage: "Enquiry",
    followup: "Today",
    value: 0,
    month: "Sep",
    phone,
    email: "",
    color: "",
    budget: "Under 5K",
    paymentType: "Cash",
    source: "WhatsApp",
    notes: "Created automatically from an incoming Twilio WhatsApp demo message."
  };

  await pool.query(
    `INSERT INTO component_enquiries
      (id, customer, contact, stage, followup, value, month, phone, email, color, budget, paymentType, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      demoEnquiry.id,
      demoEnquiry.customer,
      demoEnquiry.contact,
      demoEnquiry.stage,
      demoEnquiry.followup,
      demoEnquiry.value,
      demoEnquiry.month,
      demoEnquiry.phone,
      demoEnquiry.email,
      demoEnquiry.color,
      demoEnquiry.budget,
      demoEnquiry.paymentType,
      demoEnquiry.source,
      demoEnquiry.notes
    ]
  );

  return demoEnquiry;
}

async function saveCommunication(communication) {
  await pool.query(
    `INSERT INTO communication_history
      (id, enquiryId, customer, component, channel, message, nextAction)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      communication.id,
      communication.enquiryId,
      communication.customer,
      communication.component,
      communication.channel,
      communication.message,
      communication.nextAction
    ]
  );

  broadcastCommunication(communication);
}

async function queueWhatsAppReply(phone, message) {
  const formattedPhone = formatWhatsAppNumber(phone);

  if (!formattedPhone || !message.trim()) {
    throw new Error("A valid WhatsApp number and queued message are required.");
  }

  pendingWhatsAppReplies.set(formattedPhone, message.trim());
  await pool.query(
    `INSERT INTO pending_whatsapp_replies (phone, message)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE message = VALUES(message), createdAt = CURRENT_TIMESTAMP`,
    [formattedPhone, message.trim()]
  );

  return formattedPhone;
}

async function takeQueuedWhatsAppReply(phone) {
  const formattedPhone = formatWhatsAppNumber(phone);

  if (!formattedPhone) {
    return "";
  }

  const memoryReply = pendingWhatsAppReplies.get(formattedPhone);
  if (memoryReply) {
    pendingWhatsAppReplies.delete(formattedPhone);
    await pool.query("DELETE FROM pending_whatsapp_replies WHERE phone = ?", [formattedPhone]);
    return memoryReply;
  }

  const [rows] = await pool.query("SELECT message FROM pending_whatsapp_replies WHERE phone = ? LIMIT 1", [formattedPhone]);
  if (!rows.length) {
    return "";
  }

  await pool.query("DELETE FROM pending_whatsapp_replies WHERE phone = ?", [formattedPhone]);
  return rows[0].message;
}

async function sendTwilioWhatsAppMessage({ to, message, contentSid }) {
  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error("Twilio credentials are not configured.");
  }

  const toNumber = formatWhatsAppNumber(to);
  if (!toNumber || !message.trim()) {
    throw new Error("A valid WhatsApp number and message are required.");
  }

  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
  const selectedContentSid = contentSid || twilioContentSid;

  if (selectedContentSid) {
    const templateForm = new URLSearchParams({
      From: twilioWhatsAppFrom,
      To: toNumber,
      ContentSid: selectedContentSid,
      ContentVariables: JSON.stringify({
        1: new Date().toLocaleDateString("en-IN"),
        2: message.trim()
      })
    });
    const templateResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: templateForm
      }
    );

    if (!templateResponse.ok) {
      throw new Error(`Twilio template send failed: ${await templateResponse.text()}`);
    }

    return templateResponse.json();
  }

  const form = new URLSearchParams({
    From: twilioWhatsAppFrom,
    To: toNumber,
    Body: message.trim()
  });
  const twilioResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    }
  );

  if (twilioResponse.ok) {
    return twilioResponse.json();
  }

  const errorText = await twilioResponse.text();
  let errorBody = {};

  try {
    errorBody = JSON.parse(errorText);
  } catch {
    errorBody = {};
  }

  throw new Error(`Twilio send failed: ${errorText}`);
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/enquiries", async (_request, response, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM component_enquiries ORDER BY id DESC");
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/enquiries", async (request, response, next) => {
  try {
    const lead = leadFromBody(request.body);
    const duplicate = await findDuplicateLead(lead);

    if (duplicate) {
      response.status(409).json({
        error: `Duplicate enquiry found for ${duplicate.customer} (${duplicate.contact}).`
      });
      return;
    }

    await pool.query(
      `INSERT INTO component_enquiries
        (id, customer, contact, stage, followup, value, month, phone, email, color, budget, paymentType, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead.id,
        lead.customer,
        lead.contact,
        lead.stage,
        lead.followup,
        lead.value,
        lead.month,
        lead.phone,
        lead.email,
        lead.color,
        lead.budget,
        lead.paymentType,
        lead.source,
        lead.notes
      ]
    );
    response.status(201).json(lead);
  } catch (error) {
    next(error);
  }
});

app.put("/api/enquiries/:id", async (request, response, next) => {
  try {
    const lead = leadFromBody(request.body, Number(request.params.id));
    const duplicate = await findDuplicateLead(lead);

    if (duplicate) {
      response.status(409).json({
        error: `Duplicate enquiry found for ${duplicate.customer} (${duplicate.contact}).`
      });
      return;
    }

    await pool.query(
      `UPDATE component_enquiries
       SET customer = ?, contact = ?, stage = ?, followup = ?, value = ?, month = ?, phone = ?, email = ?,
           color = ?, budget = ?, paymentType = ?, source = ?, notes = ?
       WHERE id = ?`,
      [
        lead.customer,
        lead.contact,
        lead.stage,
        lead.followup,
        lead.value,
        lead.month,
        lead.phone,
        lead.email,
        lead.color,
        lead.budget,
        lead.paymentType,
        lead.source,
        lead.notes,
        lead.id
      ]
    );
    response.json(lead);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/enquiries/:id/stage", async (request, response, next) => {
  try {
    await pool.query("UPDATE component_enquiries SET stage = ? WHERE id = ?", [request.body.stage, Number(request.params.id)]);
    response.json({ id: Number(request.params.id), stage: request.body.stage });
  } catch (error) {
    next(error);
  }
});

app.get("/api/components", async (_request, response, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM component_inventory ORDER BY model");
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/communications", async (_request, response, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM communication_history ORDER BY createdAt DESC, id DESC");
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/communications/stream", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();
  response.write("event: ready\ndata: {\"ok\":true}\n\n");

  communicationClients.add(response);

  request.on("close", () => {
    communicationClients.delete(response);
  });
});

app.post("/api/communications", async (request, response, next) => {
  try {
    const communication = communicationFromBody(request.body);

    if (!communication.enquiryId || !communication.customer || !communication.component || !communication.message.trim()) {
      response.status(400).json({ error: "Customer, component, channel, and message are required." });
      return;
    }

    await saveCommunication(communication);
    response.status(201).json(communication);
  } catch (error) {
    next(error);
  }
});

app.post("/api/communications/send-whatsapp", async (request, response, next) => {
  let communication;

  try {
    communication = communicationFromBody({
      ...request.body,
      channel: "WhatsApp",
      nextAction: "Website reply"
    });

    if (!communication.enquiryId || !communication.customer || !communication.component || !communication.message.trim()) {
      response.status(400).json({ error: "Customer, component, WhatsApp number, and message are required." });
      return;
    }

    if (twilioTrialMode) {
      await queueWhatsAppReply(request.body.to || request.body.phone, communication.message);
      await saveCommunication({
        ...communication,
        nextAction: "Website reply queued"
      });
      response.status(202).json({
        ...communication,
        nextAction: "Website reply queued",
        queued: true
      });
      return;
    }

    await sendTwilioWhatsAppMessage({
      to: request.body.to || request.body.phone,
      message: communication.message,
      contentSid: request.body.contentSid
    });
    await saveCommunication(communication);
    response.status(201).json(communication);
  } catch (error) {
    const message = error.message || "Twilio send failed.";
    const canQueueForTrial =
      communication &&
      request.body.to &&
      (message.includes("21654") || message.includes("21655") || message.includes("ContentSid"));

    if (canQueueForTrial) {
      await queueWhatsAppReply(request.body.to || request.body.phone, communication.message);
      await saveCommunication({
        ...communication,
        nextAction: "Website reply queued"
      });
      response.status(202).json({
        ...communication,
        nextAction: "Website reply queued",
        queued: true
      });
      return;
    }

    response.status(502).json({ error: message });
  }
});

app.get("/api/webhooks/whatsapp", (request, response) => {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  if (mode === "subscribe" && token === whatsappVerifyToken) {
    response.status(200).send(challenge);
    return;
  }

  response.sendStatus(403);
});

app.post("/api/webhooks/whatsapp", async (request, response, next) => {
  try {
    const incoming = extractWhatsAppMessage(request.body);
    const phone = normalizePhone(incoming.phone || "");
    const message = incoming.message || "";
    const enquiry = await findOrCreateWhatsAppEnquiry(incoming.phone || phone);

    if (!enquiry || !message.trim()) {
      response.status(200).json({ received: true, saved: false });
      return;
    }

    const communication = {
      id: Date.now(),
      enquiryId: enquiry.id,
      customer: enquiry.customer,
      component: enquiry.contact,
      channel: "WhatsApp",
      message: message.trim(),
      nextAction: "Incoming customer message",
      senderPhone: incoming.phone || phone,
      createdAt: new Date().toISOString()
    };

    await saveCommunication(communication);

    if (isTwilioWebhook(request.body)) {
      const pendingReply = await takeQueuedWhatsAppReply(incoming.phone || phone);

      if (pendingReply) {
        response.type("text/xml").status(200).send(`<Response><Message>${escapeXml(pendingReply)}</Message></Response>`);
        return;
      }

      response.type("text/xml").status(200).send("<Response></Response>");
      return;
    }

    response.status(201).json(request.body.object ? { received: true, saved: true } : communication);
  } catch (error) {
    next(error);
  }
});

app.get("/api/leads", (_request, response) => {
  response.redirect(307, "/api/enquiries");
});

app.post("/api/leads", (request, response) => {
  response.redirect(307, "/api/enquiries");
});

app.put("/api/leads/:id", (request, response) => {
  response.redirect(307, `/api/enquiries/${request.params.id}`);
});

app.patch("/api/leads/:id/stage", (request, response) => {
  response.redirect(307, `/api/enquiries/${request.params.id}/stage`);
});

app.get("/api/inventory", (_request, response) => {
  response.redirect(307, "/api/components");
});

app.post("/api/inventory", (request, response) => {
  response.redirect(307, "/api/components");
});

app.put("/api/inventory/:id", (request, response) => {
  response.redirect(307, `/api/components/${request.params.id}`);
});

app.post("/api/components", async (request, response, next) => {
  try {
    const car = carFromBody(request.body);
    await pool.query(
      "INSERT INTO component_inventory (id, model, variant, price, stock, colors, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [car.id, car.model, car.variant, car.price, car.stock, car.colors, car.status]
    );
    response.status(201).json(car);
  } catch (error) {
    next(error);
  }
});

app.put("/api/components/:id", async (request, response, next) => {
  try {
    const car = carFromBody(request.body, Number(request.params.id));
    await pool.query(
      "UPDATE component_inventory SET model = ?, variant = ?, price = ?, stock = ?, colors = ?, status = ? WHERE id = ?",
      [car.model, car.variant, car.price, car.stock, car.colors, car.status, car.id]
    );
    response.json(car);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Database request failed" });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize MySQL database.");
    console.error(error);
    process.exit(1);
  });
