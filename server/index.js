import express from "express";
import cors from "cors";
import { initializeDatabase, pool } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT || 4000);
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1";
const communicationClients = new Set();

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
    paymentStatus: body.paymentStatus || "Pending",
    amountPaid: Number(body.amountPaid || 0),
    paymentReference: body.paymentReference || "",
    paymentDueDate: body.paymentDueDate || "",
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

function extractJsonObject(text = "") {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Ollama did not return JSON.");
  }

  return JSON.parse(match[0]);
}

function normalizeAiDraft(draft = {}, fallbackDraft = {}) {
  return {
    customer: draft.customer || fallbackDraft.customer || "",
    contact: draft.contact || fallbackDraft.contact || "",
    value: draft.value !== undefined ? String(draft.value || "") : String(fallbackDraft.value || ""),
    phone: draft.phone || fallbackDraft.phone || "",
    email: draft.email || fallbackDraft.email || "",
    color: draft.color || fallbackDraft.color || "",
    budget: draft.budget || fallbackDraft.budget || "Under 5K",
    paymentType: draft.paymentType || fallbackDraft.paymentType || "Cash",
    paymentStatus: draft.paymentStatus || fallbackDraft.paymentStatus || "Pending",
    amountPaid: draft.amountPaid !== undefined ? String(draft.amountPaid || "") : String(fallbackDraft.amountPaid || ""),
    paymentReference: draft.paymentReference || fallbackDraft.paymentReference || "",
    paymentDueDate: draft.paymentDueDate || fallbackDraft.paymentDueDate || "",
    source: draft.source || fallbackDraft.source || "Telegram",
    followup: draft.followup || fallbackDraft.followup || "Today",
    quantity: draft.quantity !== undefined ? String(draft.quantity || "") : String(fallbackDraft.quantity || ""),
    requirementSummary: draft.requirementSummary || fallbackDraft.requirementSummary || "No clear requirement detected yet.",
    confidence: draft.confidence || fallbackDraft.confidence || "Needs review",
    notes: draft.notes || fallbackDraft.notes || ""
  };
}

function extractTelegramMessage(body) {
  const message = body.message || body.edited_message || body.channel_post;
  const chat = message?.chat;
  const from = message?.from || {};
  const text =
    message?.text ||
    message?.caption ||
    message?.contact?.phone_number ||
    (message?.location ? "[location shared]" : "");

  if (!message || !chat?.id) {
    return { chatId: "", message: "", customer: "" };
  }

  const displayName =
    [from.first_name, from.last_name].filter(Boolean).join(" ") ||
    from.username ||
    chat.title ||
    `Telegram ${String(chat.id).slice(-4)}`;

  return {
    chatId: String(chat.id),
    message: text || `[${message.new_chat_members ? "member update" : "message received"}]`,
    customer: displayName
  };
}

function formatTelegramChatId(value = "") {
  const trimmedValue = String(value).trim();
  if (trimmedValue.startsWith("telegram:")) {
    return trimmedValue.replace("telegram:", "");
  }

  return trimmedValue;
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

async function findOrCreateTelegramEnquiry(chatId, customerName) {
  const telegramContact = `telegram:${formatTelegramChatId(chatId)}`;
  const [enquiries] = await pool.query("SELECT * FROM component_enquiries ORDER BY id DESC");
  const existingEnquiry = enquiries.find((item) => item.phone === telegramContact);

  if (existingEnquiry || !chatId) {
    return existingEnquiry;
  }

  const demoEnquiry = {
    id: Date.now(),
    customer: customerName || `Telegram ${String(chatId).slice(-4)}`,
    contact: "Telegram Live Chat",
    stage: "Enquiry",
    followup: "Today",
    value: 0,
    month: "Sep",
    phone: telegramContact,
    email: "",
    color: "",
    budget: "Under 5K",
    paymentType: "Cash",
    paymentStatus: "Pending",
    amountPaid: 0,
    paymentReference: "",
    paymentDueDate: "",
    source: "Telegram",
    notes: "Created automatically from an incoming Telegram message."
  };

  await pool.query(
    `INSERT INTO component_enquiries
      (id, customer, contact, stage, followup, value, month, phone, email, color, budget, paymentType, paymentStatus, amountPaid, paymentReference, paymentDueDate, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      demoEnquiry.paymentStatus,
      demoEnquiry.amountPaid,
      demoEnquiry.paymentReference,
      demoEnquiry.paymentDueDate,
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

async function sendTelegramMessage({ chatId, message }) {
  if (!telegramBotToken) {
    throw new Error("Telegram bot token is not configured.");
  }

  const formattedChatId = formatTelegramChatId(chatId);
  if (!formattedChatId || !message.trim()) {
    throw new Error("A valid Telegram chat ID and message are required.");
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: formattedChatId,
      text: message.trim()
    })
  });

  if (telegramResponse.ok) {
    return telegramResponse.json();
  }

  throw new Error(`Telegram send failed: ${await telegramResponse.text()}`);
}

app.post("/api/ai/analyze-requirement", async (request, response, next) => {
  try {
    const { fallbackDraft = {}, inventory = [], messages = [], replyTarget = null } = request.body || {};
    const chatTranscript = messages
      .map((message) => `${message.nextAction === "Incoming customer message" ? "Customer" : "Website"}: ${message.message}`)
      .join("\n");
    const inventoryText = inventory
      .map((item) => `${item.model} | price ${item.price} | specs ${item.colors || "Any"} | stock ${item.stock}`)
      .join("\n");
    const prompt = `
You are an auto parts sales CRM assistant. Analyze the customer chat and return only valid JSON.

Use these exact JSON keys:
customer, contact, value, phone, email, color, budget, paymentType, paymentStatus, amountPaid, paymentReference, paymentDueDate, source, followup, quantity, requirementSummary, confidence, notes

Allowed budget values: Under 5K, 5K - 10K, 10K - 15K, 15K - 25K, Above 25K.
Allowed paymentType values: Cash, UPI, Card, Bank Transfer, EMI, Loan, Cheque.
Allowed paymentStatus values: Pending, Advance Paid, Paid, Refunded.
Allowed followup values: Today, Tomorrow, Next Week.

Prefer matching contact to one inventory model exactly. Infer common typos, for example "break shues" means brake shoes or brake pads.

Customer/reply target:
${JSON.stringify(replyTarget)}

Inventory:
${inventoryText}

Chat:
${chatTranscript}

Fallback draft to improve:
${JSON.stringify(fallbackDraft)}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const ollamaResponse = await fetch(`${ollamaBaseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.1
        }
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      response.status(502).json({ error: `Ollama request failed: ${errorText}` });
      return;
    }

    const ollamaResult = await ollamaResponse.json();
    const aiDraft = extractJsonObject(ollamaResult.response || "");
    response.json({
      engine: "ollama",
      model: ollamaModel,
      draft: normalizeAiDraft(aiDraft, fallbackDraft)
    });
  } catch (error) {
    if (error.name === "AbortError") {
      response.status(504).json({ error: "Ollama request timed out." });
      return;
    }

    next(error);
  }
});

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
        (id, customer, contact, stage, followup, value, month, phone, email, color, budget, paymentType, paymentStatus, amountPaid, paymentReference, paymentDueDate, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        lead.paymentStatus,
        lead.amountPaid,
        lead.paymentReference,
        lead.paymentDueDate,
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
           color = ?, budget = ?, paymentType = ?, paymentStatus = ?, amountPaid = ?, paymentReference = ?,
           paymentDueDate = ?, source = ?, notes = ?
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
        lead.paymentStatus,
        lead.amountPaid,
        lead.paymentReference,
        lead.paymentDueDate,
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

app.post("/api/communications/send-telegram", async (request, response, next) => {
  let communication;

  try {
    communication = communicationFromBody({
      ...request.body,
      channel: "Telegram",
      nextAction: "Website reply"
    });

    if (!communication.enquiryId || !communication.customer || !communication.component || !communication.message.trim()) {
      response.status(400).json({ error: "Customer, component, Telegram chat ID, and message are required." });
      return;
    }

    await sendTelegramMessage({
      chatId: request.body.to || request.body.chatId || request.body.phone,
      message: communication.message
    });
    await saveCommunication(communication);
    response.status(201).json(communication);
  } catch (error) {
    response.status(502).json({ error: error.message || "Telegram send failed." });
  }
});

app.get("/api/webhooks/telegram", (_request, response) => {
  response.json({ ok: true, channel: "Telegram" });
});

app.post("/api/webhooks/telegram", async (request, response, next) => {
  try {
    const incoming = extractTelegramMessage(request.body);
    const message = incoming.message || "";
    const enquiry = await findOrCreateTelegramEnquiry(incoming.chatId, incoming.customer);

    if (!enquiry || !message.trim()) {
      response.status(200).json({ received: true, saved: false });
      return;
    }

    const communication = {
      id: Date.now(),
      enquiryId: enquiry.id,
      customer: enquiry.customer,
      component: enquiry.contact,
      channel: "Telegram",
      message: message.trim(),
      nextAction: "Incoming customer message",
      senderPhone: `telegram:${incoming.chatId}`,
      createdAt: new Date().toISOString()
    };

    await saveCommunication(communication);
    response.status(201).json({ received: true, saved: true });
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
