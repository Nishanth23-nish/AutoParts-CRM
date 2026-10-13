import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "autoforge-crm-leads";
const INVENTORY_STORAGE_KEY = "autoforge-crm-inventory";
const COMMUNICATION_STORAGE_KEY = "autoforge-crm-communications";
const AUTH_STORAGE_KEY = "autoforge-crm-auth";
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let errorMessage = "Database request failed";

    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorMessage;
    } catch {
      errorMessage = await response.text();
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

const initialLeads = [
  {
    id: 1,
    customer: "Priya Kumar",
    contact: "Brake Pad Set",
    stage: "Enquiry",
    followup: "Today",
    value: 4500,
    month: "Sep",
    phone: "+91 98765 43210",
    email: "priya@example.com",
    color: "Ceramic",
    budget: "Under 5K",
    paymentType: "Cash",
    paymentStatus: "Pending",
    amountPaid: 0,
    paymentReference: "",
    paymentDueDate: "",
    source: "Website",
    notes: "Needs front brake pad set for compact SUV service."
  },
  {
    id: 2,
    customer: "Naveen Raj",
    contact: "Car Battery",
    stage: "Requirement Discussion",
    followup: "24 Sep",
    value: 7800,
    month: "Sep",
    phone: "+91 99887 77665",
    email: "naveen@example.com",
    color: "12V 45Ah",
    budget: "5K - 10K",
    paymentType: "EMI",
    paymentStatus: "Advance Paid",
    amountPaid: 2500,
    paymentReference: "EMI-APPROVAL-102",
    paymentDueDate: "2026-09-30",
    source: "Walk-in",
    notes: "Wants warranty details before quotation."
  },
  {
    id: 3,
    customer: "Meena S",
    contact: "Engine Oil",
    stage: "Sold",
    followup: "Closed",
    value: 3200,
    month: "Aug",
    phone: "+91 90000 11122",
    email: "meena@example.com",
    color: "5W-30 Synthetic",
    budget: "Under 5K",
    paymentType: "Cash",
    paymentStatus: "Paid",
    amountPaid: 3200,
    paymentReference: "CASH-0003",
    paymentDueDate: "",
    source: "Phone",
    notes: "Purchased synthetic oil pack for regular service."
  },
  {
    id: 4,
    customer: "Rahul Menon",
    contact: "Alloy Wheel",
    stage: "Sold",
    followup: "Closed",
    value: 18500,
    month: "Jul",
    phone: "+91 88776 66554",
    email: "rahul@example.com",
    color: "16 inch Matte Black",
    budget: "15K - 25K",
    paymentType: "Loan",
    paymentStatus: "Paid",
    amountPaid: 18500,
    paymentReference: "LOAN-7781",
    paymentDueDate: "",
    source: "Instagram",
    notes: "Requested black alloy wheel set and fitting support."
  },
  {
    id: 5,
    customer: "Anita Joseph",
    contact: "Headlight Assembly",
    stage: "Lost",
    followup: "Closed",
    value: 12500,
    month: "Aug",
    phone: "+91 81234 56789",
    email: "anita@example.com",
    color: "LED Projector",
    budget: "10K - 15K",
    paymentType: "EMI",
    paymentStatus: "Pending",
    amountPaid: 0,
    paymentReference: "",
    paymentDueDate: "",
    source: "Website",
    notes: "Dropped because preferred color was unavailable."
  }
];

const pipelineStages = ["Enquiry", "Requirement Discussion", "Quotation", "Order", "Dispatch", "Sold", "Lost"];

const initialInventoryCars = [
  { id: 1, model: "Brake Pad Set", variant: "Ceramic Front", price: 4500, stock: 14, colors: "Ceramic, Semi-metallic", status: "Available" },
  { id: 2, model: "Car Battery", variant: "12V 45Ah", price: 7800, stock: 5, colors: "12V 35Ah, 12V 45Ah, 12V 60Ah", status: "Available" },
  { id: 3, model: "Engine Oil", variant: "5W-30 Synthetic", price: 3200, stock: 22, colors: "5W-30, 10W-40, 15W-40", status: "Available" },
  { id: 4, model: "Air Filter", variant: "Premium Cabin", price: 1200, stock: 18, colors: "Cabin, Engine, HEPA", status: "Available" },
  { id: 5, model: "Clutch Plate", variant: "Heavy Duty", price: 6200, stock: 7, colors: "Standard, Heavy Duty", status: "Available" },
  { id: 6, model: "Spark Plug", variant: "Iridium", price: 900, stock: 30, colors: "Copper, Platinum, Iridium", status: "Available" },
  { id: 7, model: "Headlight Assembly", variant: "LED Projector", price: 12500, stock: 3, colors: "Halogen, LED Projector", status: "Limited" },
  { id: 8, model: "Radiator", variant: "Aluminium Core", price: 9800, stock: 2, colors: "Single Fan, Dual Fan", status: "Low Stock" },
  { id: 9, model: "Alloy Wheel", variant: "16 inch Matte Black", price: 18500, stock: 4, colors: "15 inch Silver, 16 inch Matte Black, 17 inch Diamond Cut", status: "Available" },
  { id: 10, model: "Tyre", variant: "195/60 R16", price: 7600, stock: 16, colors: "175/65 R15, 195/60 R16, 205/55 R16", status: "Available" },
  { id: 11, model: "Fuel Pump", variant: "Electric", price: 5400, stock: 2, colors: "Mechanical, Electric", status: "Low Stock" },
  { id: 12, model: "Wiper Blade", variant: "Hybrid Pair", price: 1500, stock: 0, colors: "Conventional, Hybrid, Silicone", status: "Out of Stock" }
];

const emptyLeadForm = {
  customer: "",
  contact: "",
  value: "",
  followup: "Today",
  phone: "",
  email: "",
  color: "",
  budget: "Under 5K",
  paymentType: "Cash",
  paymentStatus: "Pending",
  amountPaid: "",
  paymentReference: "",
  paymentDueDate: "",
  source: "Walk-in",
  notes: ""
};

const emptyInventoryForm = {
  model: "",
  variant: "",
  price: "",
  stock: "",
  colors: "",
  status: "Available"
};

function loadSavedLeads() {
  try {
    const savedLeads = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedLeads) && savedLeads.length ? savedLeads : initialLeads;
  } catch {
    return initialLeads;
  }
}

function loadSavedInventory() {
  try {
    const savedInventory = JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY));
    return Array.isArray(savedInventory) && savedInventory.length
      ? savedInventory.map((car, index) => ({ id: car.id || Date.now() + index, ...car }))
      : initialInventoryCars;
  } catch {
    return initialInventoryCars;
  }
}

function loadSavedCommunications() {
  try {
    const savedCommunications = JSON.parse(localStorage.getItem(COMMUNICATION_STORAGE_KEY));
    return Array.isArray(savedCommunications) ? savedCommunications : [];
  } catch {
    return [];
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function stageClass(stage) {
  return stage.toLowerCase().replace(/\s+/g, "-");
}

function inventoryStatusFromStock(stock) {
  const stockCount = Number(stock || 0);
  if (stockCount <= 0) return "Out of Stock";
  if (stockCount <= 2) return "Low Stock";
  if (stockCount <= 3) return "Limited";
  return "Available";
}

function nextPipelineStage(stage) {
  const activeStages = pipelineStages.filter((item) => !["Sold", "Lost"].includes(item));
  const index = activeStages.indexOf(stage);
  return index >= 0 && index < activeStages.length - 1 ? activeStages[index + 1] : null;
}

function AuthPage({ handleLogin, loginError, loginForm, setLoginForm }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-intro">
          <div className="auth-brand-mark">DF</div>
          <p className="eyebrow">Secure CRM Access</p>
          <h1>DevForge AutoParts CRM</h1>
          <p>Manage component enquiries, WhatsApp conversations, stock, and sales pipeline from one workspace.</p>
          <div className="auth-proof-grid">
            <div>
              <strong>Live chat</strong>
              <span>Twilio WhatsApp messages in one view</span>
            </div>
            <div>
              <strong>Smart leads</strong>
              <span>AI extracts customer requirements</span>
            </div>
            <div>
              <strong>Pipeline</strong>
              <span>Track enquiry to dispatch</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Sign in</h2>
            <p>Use your workspace credentials to continue.</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            {loginError && <div className="form-alert">{loginError}</div>}
            <label>
              Username
              <input
                autoComplete="username"
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                placeholder="Enter username"
                value={loginForm.username}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  placeholder="Enter password"
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                />
                <button onClick={() => setShowPassword((current) => !current)} type="button">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className="primary-action auth-submit" type="submit">
              Sign in
            </button>
          </form>

        </div>
      </section>
    </main>
  );
}

function App() {
  const [page, setPage] = useState(() => window.location.hash.replace("#/", "") || "dashboard");
  const [leads, setLeads] = useState(loadSavedLeads);
  const [inventory, setInventory] = useState(loadSavedInventory);
  const [communications, setCommunications] = useState(loadSavedCommunications);
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) === "true");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialLeads[0].id);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [form, setForm] = useState(emptyLeadForm);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    function syncPage() {
      const nextPage = window.location.hash.replace("#/", "") || "dashboard";
      setPage(
        ["dashboard", "enquiries", "customer-details", "pipeline", "inventory", "communication-app"].includes(nextPage)
          ? nextPage
          : "dashboard"
      );
    }

    window.addEventListener("hashchange", syncPage);
    syncPage();
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem(COMMUNICATION_STORAGE_KEY, JSON.stringify(communications));
  }, [communications]);

  useEffect(() => {
    let isMounted = true;

    async function loadDatabaseData() {
      try {
        const [databaseLeads, databaseInventory, databaseCommunications] = await Promise.all([
          apiRequest("/enquiries"),
          apiRequest("/components"),
          apiRequest("/communications")
        ]);

        if (!isMounted) return;

        if (databaseLeads.length) {
          setLeads(databaseLeads);
        } else {
          await Promise.all(leads.map((lead) => apiRequest("/enquiries", {
            method: "POST",
            body: JSON.stringify(lead)
          })));
        }

        if (databaseInventory.length) {
          setInventory(databaseInventory);
        } else {
          await Promise.all(inventory.map((car) => apiRequest("/components", {
            method: "POST",
            body: JSON.stringify(car)
          })));
        }

        setCommunications(databaseCommunications);

        if (isMounted) {
          setApiOnline(true);
        }
      } catch {
        if (isMounted) {
          setApiOnline(false);
        }
      }
    }

    loadDatabaseData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const events = new EventSource(`${API_BASE}/communications/stream`);

    events.addEventListener("communication", (event) => {
      const record = JSON.parse(event.data);
      addCommunicationRecord(record);
    });

    return () => events.close();
  }, []);

  const metrics = useMemo(() => {
    const activeLeads = leads.filter((lead) => !["Sold", "Lost"].includes(lead.stage));
    const pipelineValue = activeLeads.reduce((total, lead) => total + Number(lead.value || 0), 0);

    return [
      { label: "Total Customers", value: leads.length },
      { label: "Component Enquiries", value: activeLeads.length },
      { label: "Today Requirement Discussions", value: leads.filter((lead) => lead.followup === "Today").length },
      { label: "Sales Pipeline", value: formatCurrency(pipelineValue) },
      { label: "Components Sold", value: leads.filter((lead) => lead.stage === "Sold").length }
    ];
  }, [leads]);

  const pipeline = useMemo(
    () =>
      pipelineStages.map((stage) => ({
        stage,
        count: leads.filter((lead) => lead.stage === stage).length
      })),
    [leads]
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.customer.trim() || !form.contact.trim()) return;

    const normalizeText = (value) => value.trim().toLowerCase();
    const normalizePhone = (value) => value.replace(/\D/g, "");
    const newPhone = normalizePhone(form.phone);
    const newEmail = normalizeText(form.email);
    const duplicate = leads.find((lead) => {
      if (lead.id === editingLeadId) return false;

      const existingPhone = normalizePhone(lead.phone || "");
      const existingEmail = normalizeText(lead.email || "");
      const samePhone = newPhone && existingPhone === newPhone;
      const sameEmail = newEmail && existingEmail === newEmail;

      return samePhone || sameEmail;
    });

    if (duplicate) {
      setDuplicateMessage(`Duplicate enquiry found for ${duplicate.customer} (${duplicate.contact}).`);
      return;
    }

    const savedLead = {
      customer: form.customer.trim(),
      contact: form.contact.trim(),
      followup: form.followup || "Today",
      value: Number(form.value || 0),
      phone: form.phone.trim(),
      email: form.email.trim(),
      color: form.color.trim(),
      budget: form.budget,
      paymentType: form.paymentType,
      paymentStatus: form.paymentStatus,
      amountPaid: Number(form.amountPaid || 0),
      paymentReference: form.paymentReference.trim(),
      paymentDueDate: form.paymentDueDate,
      source: form.source,
      notes: form.notes.trim()
    };

    if (editingLeadId) {
      const updatedLead = { ...leads.find((lead) => lead.id === editingLeadId), ...savedLead };
      setLeads((current) => current.map((lead) => (lead.id === editingLeadId ? updatedLead : lead)));
      if (apiOnline) {
        apiRequest(`/enquiries/${editingLeadId}`, {
          method: "PUT",
          body: JSON.stringify(updatedLead)
        }).catch(() => setApiOnline(false));
      }
    } else {
      const newLead = {
        id: Date.now(),
        stage: "Enquiry",
        month: "Sep",
        ...savedLead
      };
      setLeads((current) => [newLead, ...current]);
      if (apiOnline) {
        apiRequest("/enquiries", {
          method: "POST",
          body: JSON.stringify(newLead)
        }).catch(() => setApiOnline(false));
      }
    }

    setDuplicateMessage("");
    setEditingLeadId(null);
    setForm(emptyLeadForm);
  }

  function updateStage(id, stage) {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, stage } : lead)));
    if (apiOnline) {
      apiRequest(`/enquiries/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage })
      }).catch(() => setApiOnline(false));
    }
  }

  function addCommunicationRecord(record) {
    setCommunications((current) => {
      if (current.some((item) => Number(item.id) === Number(record.id))) {
        return current;
      }

      return [record, ...current];
    });
  }

  function addIncomingCommunication(record) {
    addCommunicationRecord(record);
  }

  function editLead(lead) {
    setEditingLeadId(lead.id);
    setDuplicateMessage("");
    setForm({
      customer: lead.customer,
      contact: lead.contact,
      value: String(lead.value || ""),
      followup: lead.followup || "Today",
      phone: lead.phone || "",
      email: lead.email || "",
      color: lead.color || "",
      budget: lead.budget || "Under 5K",
      paymentType: lead.paymentType || "Cash",
      paymentStatus: lead.paymentStatus || "Pending",
      amountPaid: String(lead.amountPaid || ""),
      paymentReference: lead.paymentReference || "",
      paymentDueDate: lead.paymentDueDate || "",
      source: lead.source || "Walk-in",
      notes: lead.notes || ""
    });
  }

  function cancelEdit() {
    setEditingLeadId(null);
    setDuplicateMessage("");
    setForm(emptyLeadForm);
  }

  const pageTitle = {
    dashboard: "Component Business Dashboard",
    enquiries: "Component Enquiries",
    "customer-details": "Customer Details",
    pipeline: "Sales Pipeline",
    inventory: "Inventory",
    "communication-app": "Live Communication Chat"
  }[page];

  function handleLogin(event) {
    event.preventDefault();

    if (loginForm.username === "admin" && loginForm.password === "admin123") {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      setLoginError("");
      return;
    }

    setLoginError("Invalid username or password.");
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setLoginForm({ username: "", password: "" });
  }

  if (!isAuthenticated) {
    return (
      <AuthPage
        handleLogin={handleLogin}
        loginError={loginError}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
      />
    );
  }

  return (
    <div className="page-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>AutoParts CRM</strong>
          <span>Component Sales Dashboard</span>
        </div>
        <nav className="nav-list" aria-label="Page sections">
          <a className={`nav-item ${page === "dashboard" ? "active" : ""}`} href="#/dashboard">
            Dashboard
          </a>
          <a className={`nav-item ${page === "enquiries" ? "active" : ""}`} href="#/enquiries">
            Enquiries
          </a>
          <a className={`nav-item ${page === "customer-details" ? "active" : ""}`} href="#/customer-details">
            Customer Details
          </a>
          <a className={`nav-item ${page === "pipeline" ? "active" : ""}`} href="#/pipeline">
            Pipeline
          </a>
          <a className={`nav-item ${page === "inventory" ? "active" : ""}`} href="#/inventory">
            Inventory
          </a>
          <a className={`nav-item ${page === "communication-app" ? "active" : ""}`} href="#/communication-app">
            Communication App
          </a>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Component Sales Management</p>
            <h1>{pageTitle}</h1>
          </div>
          <button className="secondary-action topbar-action" onClick={handleLogout} type="button">
            Logout
          </button>
        </header>

        {page === "dashboard" && <DashboardPage inventory={inventory} leads={leads} metrics={metrics} />}

        {page === "enquiries" && (
          <EnquiriesPage
            form={form}
            handleSubmit={handleSubmit}
            duplicateMessage={duplicateMessage}
            editingLeadId={editingLeadId}
            cancelEdit={cancelEdit}
            editLead={editLead}
            inventory={inventory}
            leads={leads}
            setPage={setPage}
            setForm={setForm}
            setSelectedCustomerId={setSelectedCustomerId}
            updateStage={updateStage}
          />
        )}

        {page === "customer-details" && (
          <CustomerDetailsPage
            leads={leads}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )}

        {page === "pipeline" && <PipelinePage leads={leads} pipeline={pipeline} updateStage={updateStage} />}

        {page === "inventory" && (
          <InventoryPage
            apiOnline={apiOnline}
            inventory={inventory}
            setApiOnline={setApiOnline}
            setInventory={setInventory}
          />
        )}

        {page === "communication-app" && (
          <CommunicationAppPage
            addIncomingCommunication={addIncomingCommunication}
            communications={communications}
            inventory={inventory}
            leads={leads}
            setForm={setForm}
            setPage={setPage}
          />
        )}
      </main>
    </div>
  );
}

function DashboardPage({ inventory, leads, metrics }) {
  const activeLeads = leads.filter((lead) => !["Sold", "Lost"].includes(lead.stage));
  const todayFollowups = activeLeads.filter((lead) => lead.followup === "Today");
  const activePipeline = pipelineStages
    .filter((stage) => !["Sold", "Lost"].includes(stage))
    .map((stage) => ({
      stage,
      count: activeLeads.filter((lead) => lead.stage === stage).length
    }));
  const inventoryAlerts = inventory.filter((car) => car.stock <= 2);

  return (
    <>
      <section className="page-intro">
        <h2>Sales Overview</h2>
        <p>View the live summary of component enquiries, requirement discussions, pipeline value, and sold units.</p>
      </section>

      <section className="metrics-grid" aria-label="CRM summary">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-workspace" aria-label="Dashboard required work">
        <article className="work-card">
          <div className="panel-header">
            <div>
              <h2>Today Follow-ups</h2>
              <p>Customers to contact today</p>
            </div>
          </div>
          <div className="mini-list">
            {todayFollowups.map((lead) => (
              <div className="mini-item" key={lead.id}>
                <div>
                  <strong>{lead.customer}</strong>
                  <span>{lead.contact}</span>
                </div>
                <span className={`badge ${stageClass(lead.stage)}`}>{lead.stage}</span>
              </div>
            ))}
            {!todayFollowups.length && <div className="empty-filter">No follow-ups scheduled today.</div>}
          </div>
        </article>

        <article className="work-card">
          <div className="panel-header">
            <div>
              <h2>Active Pipeline</h2>
              <p>Open enquiries by current stage</p>
            </div>
          </div>
          <div className="stage-list">
            {activePipeline.map((item) => (
              <div className="stage-item" key={item.stage}>
                <span>{item.stage}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="work-card">
          <div className="panel-header">
            <div>
              <h2>Recent Active Enquiries</h2>
              <p>Latest customers still in progress</p>
            </div>
          </div>
          <div className="mini-list">
            {activeLeads.slice(0, 4).map((lead) => (
              <div className="mini-item" key={lead.id}>
                <div>
                  <strong>{lead.customer}</strong>
                  <span>{lead.contact}</span>
                </div>
                <small>{lead.followup}</small>
              </div>
            ))}
            {!activeLeads.length && <div className="empty-filter">No active enquiries available.</div>}
          </div>
        </article>

        <article className="work-card">
          <div className="panel-header">
            <div>
              <h2>Inventory Alerts</h2>
              <p>Components with low stock</p>
            </div>
          </div>
          <div className="mini-list">
            {inventoryAlerts.map((car) => (
              <div className="mini-item" key={car.model}>
                <div>
                  <strong>{car.model}</strong>
                  <span>{car.variant}</span>
                </div>
                <small>{car.stock} left</small>
              </div>
            ))}
            {!inventoryAlerts.length && <div className="empty-filter">All inventory has enough stock.</div>}
          </div>
        </article>
      </section>
    </>
  );
}

function EnquiriesPage({
  cancelEdit,
  duplicateMessage,
  editingLeadId,
  editLead,
  form,
  handleSubmit,
  inventory,
  leads,
  setForm,
  setPage,
  setSelectedCustomerId,
  updateStage
}) {
  const activeLeads = leads.filter((lead) => !["Sold", "Lost"].includes(lead.stage));
  const [enquiryCustomerSearch, setEnquiryCustomerSearch] = useState("");
  const [enquiryModelSearch, setEnquiryModelSearch] = useState("");
  const activeComponentNames = useMemo(
    () => ["All components", ...new Set([...inventory.map((car) => car.model), ...leads.map((lead) => lead.contact)])],
    [inventory, leads]
  );
  const filteredActiveLeads = useMemo(() => {
    const customerQuery = enquiryCustomerSearch.trim().toLowerCase();
    const modelQuery = enquiryModelSearch.trim().toLowerCase();

    return activeLeads.filter((lead) => {
      const matchesCustomer = !customerQuery || lead.customer.toLowerCase().includes(customerQuery);
      const matchesModel = !modelQuery || lead.contact.toLowerCase().includes(modelQuery);

      return matchesCustomer && matchesModel;
    });
  }, [activeLeads, enquiryCustomerSearch, enquiryModelSearch]);
  const priceMatchesBudget = (price, budget) => {
    if (budget === "Under 5K") return price < 5000;
    if (budget === "10K - 15K") return price >= 10000 && price <= 15000;
    if (budget === "15K - 25K") return price > 15000 && price <= 25000;
    return price > 25000;
  };
  const componentOptions = useMemo(() => {
    const models = inventory
      .filter((car) => priceMatchesBudget(Number(car.price || 0), form.budget))
      .map((car) => car.model);
    const existingModel = form.contact && !models.includes(form.contact) ? [form.contact] : [];
    return [...existingModel, ...models];
  }, [form.budget, form.contact, inventory]);
  const selectedInventoryComponent = inventory.find((car) => car.model === form.contact);
  const availableSpecs = selectedInventoryComponent?.colors
    ? selectedInventoryComponent.colors.split(",").map((color) => color.trim()).filter(Boolean)
    : [];

  function handleBudgetChange(budget) {
    const selectedComponent = inventory.find((car) => car.model === form.contact);
    const keepSelectedComponent = selectedComponent && priceMatchesBudget(Number(selectedComponent.price || 0), budget);

    setForm({
      ...form,
      budget,
      contact: keepSelectedComponent ? form.contact : "",
      value: keepSelectedComponent ? form.value : "",
      color: keepSelectedComponent ? form.color : ""
    });
  }

  function handleComponentChange(model) {
    const selectedComponent = inventory.find((car) => car.model === model);
    setForm({
      ...form,
      contact: model,
      value: selectedComponent ? String(selectedComponent.price || "") : form.value,
      color: ""
    });
  }

  function openCustomerDetails(id) {
    setSelectedCustomerId(id);
    setPage("customer-details");
    window.location.hash = "#/customer-details";
  }

  return (
    <section className="panel lead-panel">
      <div className="panel-header">
        <div>
          <h2>Enquiries</h2>
          <p>Add a component enquiry and change status to update the dashboard.</p>
        </div>
      </div>

      <div className="form-card">
        <div className="panel-header">
          <div>
            <h2>{editingLeadId ? "Edit Lead" : "Add Lead"}</h2>
            <p>{editingLeadId ? "Update customer and component enquiry details" : "Simple component enquiry entry"}</p>
          </div>
        </div>

        <form className="lead-form" onSubmit={handleSubmit}>
          {duplicateMessage && <div className="form-alert">{duplicateMessage}</div>}
          <label>
            Customer
            <input
              onChange={(event) => setForm({ ...form, customer: event.target.value })}
              placeholder="Customer name"
              value={form.customer}
            />
          </label>
          <label>
            Budget Range
            <select onChange={(event) => handleBudgetChange(event.target.value)} value={form.budget}>
              <option>Under 5K</option>
              <option>10K - 15K</option>
              <option>15K - 25K</option>
              <option>Above 25K</option>
            </select>
          </label>
          <label>
            Component Unit Price
            <input
              min="0"
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              placeholder="4500"
              type="number"
              value={form.value}
            />
          </label>
          <label>
            Phone Number
            <input
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+91 98765 43210"
              value={form.phone}
            />
          </label>
          <label>
            Email
            <input
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="customer@email.com"
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Preferred Specification
            <select
              disabled={!availableSpecs.length}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
              value={form.color}
            >
              <option value="">{availableSpecs.length ? "Select specification" : "Select component first"}</option>
              {availableSpecs.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
          <label>
            Component Name
            <select onChange={(event) => handleComponentChange(event.target.value)} value={form.contact}>
              <option value="">Select component</option>
              {componentOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <div className="payment-section full-width-field">
            <div className="section-heading">
              <h3>Payment Method</h3>
              <p>Capture the customer payment plan, paid amount, reference, and due date.</p>
            </div>
            <div className="payment-grid">
              <label>
                Method
                <select
                  onChange={(event) => setForm({ ...form, paymentType: event.target.value })}
                  value={form.paymentType}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>EMI</option>
                  <option>Loan</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label>
                Payment Status
                <select
                  onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })}
                  value={form.paymentStatus}
                >
                  <option>Pending</option>
                  <option>Advance Paid</option>
                  <option>Paid</option>
                  <option>Refunded</option>
                </select>
              </label>
              <label>
                Amount Paid
                <input
                  min="0"
                  onChange={(event) => setForm({ ...form, amountPaid: event.target.value })}
                  placeholder="0"
                  type="number"
                  value={form.amountPaid}
                />
              </label>
              <label>
                Payment Reference
                <input
                  onChange={(event) => setForm({ ...form, paymentReference: event.target.value })}
                  placeholder="UPI / card / receipt ID"
                  value={form.paymentReference}
                />
              </label>
              <label>
                Due Date
                <input
                  onChange={(event) => setForm({ ...form, paymentDueDate: event.target.value })}
                  type="date"
                  value={form.paymentDueDate}
                />
              </label>
            </div>
          </div>
          <label>
            Enquiry Source
            <select onChange={(event) => setForm({ ...form, source: event.target.value })} value={form.source}>
              <option>Walk-in</option>
              <option>Website</option>
              <option>Phone</option>
              <option>Instagram</option>
            </select>
          </label>
          <label>
            Requirement Discussion
            <select onChange={(event) => setForm({ ...form, followup: event.target.value })} value={form.followup}>
              <option>Today</option>
              <option>Tomorrow</option>
              <option>Next Week</option>
            </select>
          </label>
          <label className="full-width-field">
            Notes
            <input
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Customer requirement or follow-up note"
              value={form.notes}
            />
          </label>
          <div className="form-actions">
            <button className="primary-action" type="submit">
              {editingLeadId ? "Update Enquiry" : "Add Enquiry"}
            </button>
            {editingLeadId && (
              <button className="secondary-action" onClick={cancelEdit} type="button">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="filter-card">
        <div className="panel-header">
          <div>
            <h2>Search Enquiries</h2>
            <p>Find active enquiries by customer name or component name.</p>
          </div>
        </div>
        <div className="customer-tools enquiry-search-tools">
          <label>
            Search Customer
            <input
              onChange={(event) => setEnquiryCustomerSearch(event.target.value)}
              placeholder="Customer name"
              value={enquiryCustomerSearch}
            />
          </label>
          <label>
            Search Component Name
            <select
              onChange={(event) => setEnquiryModelSearch(event.target.value)}
              value={enquiryModelSearch}
            >
              {activeComponentNames.map((model) => (
                <option key={model} value={model === "All components" ? "" : model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="lead-table">
        <div className="lead-row table-head">
          <span>Customer</span>
          <span>Component Name</span>
          <span>Contact</span>
          <span>Preference</span>
          <span>Stage</span>
          <span>Requirement Discussion</span>
          <span>Unit Price</span>
          <span>Actions</span>
        </div>
        {filteredActiveLeads.map((lead) => {
          const nextStage = nextPipelineStage(lead.stage);

          return (
            <div className="lead-row" key={lead.id}>
              <strong>{lead.customer}</strong>
              <span>{lead.contact}</span>
              <span>
                {lead.phone || "No phone"}
                <small>{lead.email || "No email"}</small>
              </span>
              <span>
                {lead.color || "Any specification"}
                <small>
                  {lead.budget || "No budget"} · {lead.paymentType || "Cash"} · {lead.paymentStatus || "Pending"} · {lead.source || "Walk-in"}
                </small>
                <small>
                  Paid {formatCurrency(Number(lead.amountPaid || 0))}
                  {lead.paymentReference ? ` · Ref ${lead.paymentReference}` : ""}
                </small>
              </span>
              <span className={`badge ${stageClass(lead.stage)}`}>{lead.stage}</span>
              <span>{lead.followup}</span>
              <span>{formatCurrency(Number(lead.value || 0))}</span>
              <div className="row-actions compact-actions">
                {nextStage && (
                  <button className="primary-row-action" type="button" onClick={() => updateStage(lead.id, nextStage)}>
                    Move to {nextStage}
                  </button>
                )}
                <button type="button" onClick={() => updateStage(lead.id, "Sold")}>
                  Sold
                </button>
                <button type="button" onClick={() => updateStage(lead.id, "Lost")}>
                  Lost
                </button>
                <button type="button" onClick={() => editLead(lead)}>
                  Edit
                </button>
                <button type="button" onClick={() => openCustomerDetails(lead.id)}>
                  Details
                </button>
              </div>
            </div>
          );
        })}
        {!filteredActiveLeads.length && <div className="empty-filter">No active enquiries match the search.</div>}
      </div>
    </section>
  );
}

function CustomerDetailsPage({ leads, selectedCustomerId, setSelectedCustomerId }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const customerDetailComponents = useMemo(() => ["All components", ...new Set(leads.map((lead) => lead.contact))], [leads]);
  const filteredLeads = useMemo(() => {
    const customerQuery = customerSearch.trim().toLowerCase();
    const modelQuery = modelSearch.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesCustomer = !customerQuery || lead.customer.toLowerCase().includes(customerQuery);
      const matchesModel = !modelQuery || lead.contact.toLowerCase().includes(modelQuery);

      return matchesCustomer && matchesModel;
    });
  }, [customerSearch, leads, modelSearch]);
  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedCustomerId) ||
    filteredLeads[0] ||
    leads.find((lead) => lead.id === selectedCustomerId) ||
    leads[0];

  if (!selectedLead) {
    return (
      <section className="panel">
        <h2>Customer Details</h2>
        <p>No customer enquiries are available.</p>
      </section>
    );
  }

  return (
    <section className="panel customer-details-page">
      <div className="panel-header">
        <div>
          <h2>Customer Details</h2>
          <p>View key information for a selected component enquiry.</p>
        </div>
        <div className="customer-tools">
          <label>
            Search Customer
            <input
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Customer name"
              value={customerSearch}
            />
          </label>
          <label>
            Search Component Name
            <select
              onChange={(event) => setModelSearch(event.target.value)}
              value={modelSearch}
            >
              {customerDetailComponents.map((model) => (
                <option key={model} value={model === "All components" ? "" : model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-select">
            Select Customer
            <select
              onChange={(event) => setSelectedCustomerId(Number(event.target.value))}
              value={selectedLead.id}
            >
              {filteredLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.customer} - {lead.contact}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!filteredLeads.length && <div className="empty-filter">No customers match the search.</div>}

      <div className="details-grid">
        <article className="detail-card">
          <span>Customer Name</span>
          <strong>{selectedLead.customer}</strong>
        </article>
        <article className="detail-card">
          <span>Interested Component Name</span>
          <strong>{selectedLead.contact}</strong>
        </article>
        <article className="detail-card">
          <span>Contact Details</span>
          <strong>{selectedLead.phone || "No phone"}</strong>
          <small>{selectedLead.email || "No email"}</small>
        </article>
        <article className="detail-card">
          <span>Requirement Discussion Date</span>
          <strong>{selectedLead.followup}</strong>
        </article>
        <article className="detail-card">
          <span>Current Stage</span>
          <strong className={`badge ${stageClass(selectedLead.stage)}`}>{selectedLead.stage}</strong>
        </article>
        <article className="detail-card detail-card-wide">
          <span>Notes</span>
          <strong>{selectedLead.notes || "No notes added."}</strong>
        </article>
      </div>

      <div className="customer-enquiry-list">
        <div className="panel-header">
          <div>
            <h2>{modelSearch ? `All Enquiries For ${modelSearch}` : "All Customer Enquiries"}</h2>
            <p>Customers who enquired, bought, or were lost for the selected component name.</p>
          </div>
        </div>

        <div className="mini-list">
          {filteredLeads.map((lead) => (
            <div className="mini-item" key={lead.id}>
              <div>
                <strong>{lead.customer}</strong>
                <span>
                  {lead.contact} · {lead.phone || "No phone"} · {lead.followup}
                </span>
              </div>
              <div className="customer-result-meta">
                <span className={`badge ${stageClass(lead.stage)}`}>{lead.stage}</span>
                <small>{formatCurrency(Number(lead.value || 0))}</small>
              </div>
            </div>
          ))}
          {!filteredLeads.length && <div className="empty-filter">No enquiries found for this component name.</div>}
        </div>
      </div>
    </section>
  );
}

function PipelinePage({ leads, pipeline, updateStage }) {
  const closedLeads = leads.filter((lead) => ["Sold", "Lost"].includes(lead.stage));
  const soldCount = leads.filter((lead) => lead.stage === "Sold").length;
  const lostCount = leads.filter((lead) => lead.stage === "Lost").length;
  const pipelineValue = leads
    .filter((lead) => !["Sold", "Lost"].includes(lead.stage))
    .reduce((total, lead) => total + Number(lead.value || 0), 0);

  return (
    <section className="panel pipeline-panel">
      <div className="panel-header">
        <div>
          <h2>Pipeline</h2>
          <p>Track customers by stage, value, next action, dispatch progress, and final outcomes.</p>
        </div>
      </div>

      <div className="pipeline-summary">
        <article>
          <span>Open Pipeline Value</span>
          <strong>{formatCurrency(pipelineValue)}</strong>
        </article>
        <article>
          <span>Components Sold</span>
          <strong>{soldCount}</strong>
        </article>
        <article>
          <span>Lost Enquiries</span>
          <strong>{lostCount}</strong>
        </article>
      </div>

      <div className="pipeline-list">
        {pipeline.map((item) => {
          const stageLeads = leads.filter((lead) => lead.stage === item.stage);
          const stageValue = stageLeads.reduce((total, lead) => total + Number(lead.value || 0), 0);
          const upcomingStage = nextPipelineStage(item.stage);

          return (
          <div className="pipeline-item" key={item.stage}>
            <div className="pipeline-stage-head">
              <div>
                <strong>{item.stage}</strong>
                <span>{item.count} enquiries</span>
              </div>
              <small>{formatCurrency(stageValue)}</small>
            </div>
            <div className="bar-track">
              <span style={{ width: `${Math.min(item.count * 20, 100)}%` }} />
            </div>
            <div className="pipeline-customer-list">
              {stageLeads.map((lead) => (
                <article className="pipeline-lead-card" key={lead.id}>
                  <div>
                    <strong>{lead.customer}</strong>
                    <span>{lead.contact}</span>
                  </div>
                  <small>
                    {lead.followup} · {formatCurrency(Number(lead.value || 0))}
                  </small>
                  <div className="pipeline-actions">
                    {upcomingStage && (
                      <button type="button" onClick={() => updateStage(lead.id, upcomingStage)}>
                        Move to {upcomingStage}
                      </button>
                    )}
                    {!["Sold", "Lost"].includes(lead.stage) && (
                      <>
                        <button type="button" onClick={() => updateStage(lead.id, "Sold")}>
                          Sold
                        </button>
                        <button type="button" onClick={() => updateStage(lead.id, "Lost")}>
                          Lost
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {!stageLeads.length && <div className="empty-filter">No customers in this stage.</div>}
            </div>
          </div>
          );
        })}
      </div>

      <div className="closed-summary">
        <div className="panel-header">
          <div>
            <h2>Sold / Lost Summary</h2>
            <p>Closed customer outcomes for quick review.</p>
          </div>
        </div>
        <div className="mini-list">
          {closedLeads.map((lead) => (
            <div className="mini-item" key={lead.id}>
              <div>
                <strong>{lead.customer}</strong>
                <span>{lead.contact}</span>
              </div>
              <span className={`badge ${stageClass(lead.stage)}`}>{lead.stage}</span>
            </div>
          ))}
          {!closedLeads.length && <div className="empty-filter">No closed enquiries yet.</div>}
        </div>
      </div>
    </section>
  );
}

function InventoryPage({ apiOnline, inventory, setApiOnline, setInventory }) {
  const [inventoryForm, setInventoryForm] = useState(emptyInventoryForm);
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const totalComponents = inventory.reduce((total, car) => total + Number(car.stock || 0), 0);
  const lowStock = inventory.filter((car) => Number(car.stock || 0) <= 2).length;

  function handleInventorySubmit(event) {
    event.preventDefault();
    if (!inventoryForm.model.trim() || !inventoryForm.variant.trim()) return;

    const savedCar = {
      model: inventoryForm.model.trim(),
      variant: inventoryForm.variant.trim(),
      price: Number(inventoryForm.price || 0),
      stock: Number(inventoryForm.stock || 0),
      colors: inventoryForm.colors.trim(),
      status: inventoryStatusFromStock(inventoryForm.stock)
    };

    if (editingInventoryId) {
      const updatedCar = { ...inventory.find((car) => car.id === editingInventoryId), ...savedCar };
      setInventory((current) => current.map((car) => (car.id === editingInventoryId ? updatedCar : car)));
      if (apiOnline) {
        apiRequest(`/components/${editingInventoryId}`, {
          method: "PUT",
          body: JSON.stringify(updatedCar)
        }).catch(() => setApiOnline(false));
      }
    } else {
      const newCar = { id: Date.now(), ...savedCar };
      setInventory((current) => [newCar, ...current]);
      if (apiOnline) {
        apiRequest("/components", {
          method: "POST",
          body: JSON.stringify(newCar)
        }).catch(() => setApiOnline(false));
      }
    }

    setInventoryForm(emptyInventoryForm);
    setEditingInventoryId(null);
  }

  function editInventory(car) {
    setEditingInventoryId(car.id);
    setInventoryForm({
      model: car.model,
      variant: car.variant,
      price: String(car.price || ""),
      stock: String(car.stock || ""),
      colors: car.colors || "",
      status: car.status || "Available"
    });
  }

  function cancelInventoryEdit() {
    setEditingInventoryId(null);
    setInventoryForm(emptyInventoryForm);
  }

  return (
    <section className="panel inventory-panel">
      <div className="panel-header">
        <div>
          <h2>Component Inventory</h2>
          <p>Track available components, stock count, specifications, and status.</p>
        </div>
      </div>

      <div className="inventory-summary">
        <article>
          <span>Total Stock</span>
          <strong>{totalComponents}</strong>
        </article>
        <article>
          <span>Components</span>
          <strong>{inventory.length}</strong>
        </article>
        <article>
          <span>Low Stock</span>
          <strong>{lowStock}</strong>
        </article>
      </div>

      <div className="form-card">
        <div className="panel-header">
          <div>
            <h2>{editingInventoryId ? "Edit Stock" : "Add New Component"}</h2>
            <p>{editingInventoryId ? "Update component details and stock count" : "Add a new component to inventory"}</p>
          </div>
        </div>

        <form className="lead-form" onSubmit={handleInventorySubmit}>
          <label>
            Component Name
            <input
              onChange={(event) => setInventoryForm({ ...inventoryForm, model: event.target.value })}
              placeholder="Component name"
              value={inventoryForm.model}
            />
          </label>
          <label>
            Component Type
            <input
              onChange={(event) => setInventoryForm({ ...inventoryForm, variant: event.target.value })}
              placeholder="Component Type"
              value={inventoryForm.variant}
            />
          </label>
          <label>
            Unit Price
            <input
              min="0"
              onChange={(event) => setInventoryForm({ ...inventoryForm, price: event.target.value })}
              placeholder="4500"
              type="number"
              value={inventoryForm.price}
            />
          </label>
          <label>
            Stock
            <input
              min="0"
              onChange={(event) => setInventoryForm({ ...inventoryForm, stock: event.target.value })}
              placeholder="5"
              type="number"
              value={inventoryForm.stock}
            />
          </label>
          <label>
            Specifications
            <input
              onChange={(event) => setInventoryForm({ ...inventoryForm, colors: event.target.value })}
              placeholder="White, Black"
              value={inventoryForm.colors}
            />
          </label>
          <label>
            Status
            <input
              readOnly
              value={inventoryStatusFromStock(inventoryForm.stock)}
            />
          </label>
          <div className="form-actions">
            <button className="primary-action" type="submit">
              {editingInventoryId ? "Update Stock" : "Add Component"}
            </button>
            {editingInventoryId && (
              <button className="secondary-action" onClick={cancelInventoryEdit} type="button">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="inventory-table">
        <div className="inventory-row table-head">
          <span>Component Name</span>
          <span>Component Type</span>
          <span>Unit Price</span>
          <span>Stock</span>
          <span>Specifications</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {inventory.map((car) => (
          <div className="inventory-row" key={car.id}>
            <strong>{car.model}</strong>
            <span>{car.variant}</span>
            <span>{formatCurrency(car.price)}</span>
            <span>{car.stock} units</span>
            <span>{car.colors}</span>
            <span className={`badge ${car.stock <= 2 ? "lost" : "sold"}`}>{car.status}</span>
            <div className="row-actions">
              <button type="button" onClick={() => editInventory(car)}>
                Edit Stock
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommunicationAppPage({ addIncomingCommunication, communications, inventory, leads, setForm, setPage }) {
  const activeLeads = leads.filter((lead) => !["Sold", "Lost"].includes(lead.stage));
  const firstLead = activeLeads[0] || leads[0];
  const [chatMessage, setChatMessage] = useState("");
  const [chatToNumber, setChatToNumber] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [aiDraft, setAiDraft] = useState(null);
  const selectedLead = firstLead;
  const liveChatRecords = communications.slice().reverse();
  const latestIncomingWhatsApp = communications.find(
    (record) => record.nextAction === "Incoming customer message" && record.senderPhone
  );
  const replyTarget = latestIncomingWhatsApp
    ? {
        enquiryId: latestIncomingWhatsApp.enquiryId,
        customer: latestIncomingWhatsApp.customer,
        component: latestIncomingWhatsApp.component,
        phone: latestIncomingWhatsApp.senderPhone
      }
    : selectedLead
      ? {
          enquiryId: selectedLead.id,
          customer: selectedLead.customer,
          component: selectedLead.contact,
          phone: selectedLead.phone
        }
      : null;

  const visibleChatTranscript = liveChatRecords
    .filter((record) => record.nextAction === "Incoming customer message")
    .filter(isMeaningfulRequirementMessage)
    .slice(-3)
    .map((record) => {
      return `Customer: ${record.message}`;
    })
    .join("\n");

  function budgetFromPrice(price) {
    if (price < 5000) return "Under 5K";
    if (price <= 15000) return "10K - 15K";
    if (price <= 25000) return "15K - 25K";
    return "Above 25K";
  }

  function normalizeCustomerText(text) {
    return text
      .toLowerCase()
      .replace(/\bbreak\b/g, "brake")
      .replace(/\bshue\b/g, "shoe")
      .replace(/\bshues\b/g, "shoes")
      .replace(/\bbrake shoe(s)?\b/g, "brake pad")
      .replace(/\bbrake pad(s)?\b/g, "brake pad set");
  }

  function isMeaningfulRequirementMessage(record) {
    const text = normalizeCustomerText(record.message || "").trim();
    if (!text) return false;
    if (/^(hi+|hello|hey|ok|okay|yes|no|thanks?|thank you|mobile trigger)$/i.test(text)) return false;
    if (/\b(test|trigger|check|receive|received|ngrok|twilio|join)\b/i.test(text) && text.split(/\s+/).length < 5) {
      return false;
    }

    const productWords = inventory.some((item) =>
      item.model
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && text.includes(word))
    );
    const intentWords = /\b(want|need|order|buy|looking|require|available|price|cost|quote|quotation|budget|emi|loan|cash)\b/i.test(text);

    return productWords || intentWords || /\d/.test(text);
  }

  function getRequirementRecords() {
    const incomingRecords = liveChatRecords.filter((record) => record.nextAction === "Incoming customer message");
    const meaningfulRecords = incomingRecords.filter(isMeaningfulRequirementMessage);
    const latestMeaningful = meaningfulRecords[meaningfulRecords.length - 1];

    if (!latestMeaningful) {
      return incomingRecords.slice(-1);
    }

    const sameCustomerRecords = meaningfulRecords.filter((record) => {
      const latestIdentity = latestMeaningful.senderPhone || latestMeaningful.customer;
      const recordIdentity = record.senderPhone || record.customer;
      return latestIdentity === recordIdentity;
    });

    return sameCustomerRecords.slice(-3);
  }

  function analyzeRequirement() {
    const incomingRecords = liveChatRecords.filter((record) => record.nextAction === "Incoming customer message");
    const requirementRecords = getRequirementRecords();
    const latestIncoming = requirementRecords[requirementRecords.length - 1] || incomingRecords[incomingRecords.length - 1];
    const latestRecord = liveChatRecords[liveChatRecords.length - 1];
    const allText = requirementRecords.map((record) => record.message).join(" ");
    const incomingText = requirementRecords.map((record) => record.message).join(" ");
    const normalizedText = normalizeCustomerText(incomingText);
    const componentAliases = [
      { pattern: /\bbrake\s+(shoe|shoes|pad|pads|pad set)\b/, model: "Brake Pad Set" },
      { pattern: /\bbattery\b/, model: "Car Battery" },
      { pattern: /\boil\b/, model: "Engine Oil" },
      { pattern: /\bair\s*filter\b/, model: "Air Filter" },
      { pattern: /\bclutch\b/, model: "Clutch Plate" },
      { pattern: /\bspark\s*plug\b/, model: "Spark Plug" },
      { pattern: /\bhead\s*light|\bheadlight\b/, model: "Headlight Assembly" },
      { pattern: /\bradiator\b/, model: "Radiator" },
      { pattern: /\balloy|wheel\b/, model: "Alloy Wheel" },
      { pattern: /\btyre|\btire\b/, model: "Tyre" },
      { pattern: /\bfuel\s*pump\b/, model: "Fuel Pump" },
      { pattern: /\bwiper\b/, model: "Wiper Blade" }
    ];
    const aliasMatch = componentAliases.find((alias) => alias.pattern.test(normalizedText));
    const matchedComponent =
      (aliasMatch && inventory.find((item) => item.model === aliasMatch.model)) ||
      inventory.find((item) => normalizedText.includes(item.model.toLowerCase())) ||
      inventory.find((item) =>
        item.model
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.length > 3 && normalizedText.includes(word))
      );
    const fallbackComponent =
      latestIncoming?.component && latestIncoming.component !== "Twilio Live Chat" ? latestIncoming.component : "";
    const specs = matchedComponent?.colors
      ? matchedComponent.colors.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const matchedSpec = specs.find((spec) => normalizedText.includes(spec.toLowerCase())) || "";
    const inferredPayment = normalizedText.includes("emi") ? "EMI" : normalizedText.includes("loan") ? "Loan" : "Cash";
    const inferredSource = latestIncoming?.channel === "WhatsApp" ? "Phone" : "Website";
    const detectedEmail = allText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || "";
    const inferredFollowup = normalizedText.includes("next week")
      ? "Next Week"
      : normalizedText.includes("tomorrow")
        ? "Tomorrow"
        : "Today";
    const quantityMatch = normalizedText.match(/\b(\d+)\s*(?:pcs?|pieces?|set|sets|unit|units)?\b/);
    const quantity = quantityMatch ? quantityMatch[1] : "";
    const cleanRequirement = requirementRecords.map((record) => record.message.trim()).filter(Boolean).join(" ");
    const detectedComponentName = matchedComponent?.model || fallbackComponent;
    const confidence = matchedComponent ? "High" : cleanRequirement ? "Needs review" : "No requirement detected";
    const notes = cleanRequirement
      ? [
          `Customer requirement: ${cleanRequirement}`,
          detectedComponentName ? `Detected component: ${detectedComponentName}` : "Detected component: Not clear",
          quantity ? `Quantity: ${quantity}` : "",
          matchedSpec ? `Preferred specification: ${matchedSpec}` : ""
        ]
          .filter(Boolean)
          .join("\n")
      : "No clear customer requirement found yet.";
    const draft = {
      customer: latestIncoming?.customer || latestRecord?.customer || replyTarget?.customer || "",
      contact: detectedComponentName,
      value: matchedComponent ? String(matchedComponent.price || "") : "",
      phone: latestIncoming?.senderPhone || replyTarget?.phone || "",
      email: detectedEmail,
      color: matchedSpec,
      budget: matchedComponent ? budgetFromPrice(Number(matchedComponent.price || 0)) : "Under 5K",
      paymentType: inferredPayment,
      paymentStatus: "Pending",
      amountPaid: "",
      paymentReference: "",
      paymentDueDate: "",
      source: inferredSource,
      followup: inferredFollowup,
      quantity,
      requirementSummary: cleanRequirement || "No clear requirement detected yet.",
      confidence,
      notes
    };

    setAiDraft(draft);
  }

  function applyAiDraft() {
    if (!aiDraft) return;

    setForm(aiDraft);
    setPage("enquiries");
    window.location.hash = "#/enquiries";
  }

  async function handleChatReplySubmit(event) {
    event.preventDefault();
    if (!replyTarget || !chatMessage.trim()) return;

    const record = {
      id: Date.now(),
      enquiryId: replyTarget.enquiryId,
      customer: replyTarget.customer,
      component: replyTarget.component,
      channel: "WhatsApp",
      message: chatMessage.trim(),
      nextAction: "Website reply"
    };

    try {
      const sentRecord = await apiRequest("/communications/send-whatsapp", {
        method: "POST",
        body: JSON.stringify({
          ...record,
          to: chatToNumber.trim() || replyTarget.phone
        })
      });
      addIncomingCommunication(sentRecord);
      setChatMessage("");
      setChatStatus(
        sentRecord.queued
          ? "Reply queued for Twilio trial. Send any WhatsApp message from your mobile now, and Twilio will deliver this website reply back to the mobile."
          : "WhatsApp reply sent through Twilio."
      );
    } catch (error) {
      setChatStatus(error.message || "Could not send through Twilio. Check Twilio credentials in .env and restart backend.");
    }
  }

  return (
    <section className="panel communication-page">
      <div className="panel-header">
        <div>
          <h2>Live Communication Chat</h2>
          <p>Incoming WhatsApp messages appear here automatically while follow-ups stay saved in history.</p>
        </div>
      </div>

      <div className="chat-ai-layout">
        <div className="live-chatbox">
          <div className="chatbox-header">
            <div>
              <h2>Twilio WhatsApp Live Chat</h2>
              <p>Incoming messages appear instantly. In Twilio trial mode, website replies are delivered after the customer sends the next WhatsApp message.</p>
            </div>
            <span className="badge">Live</span>
          </div>

          <div className="chat-window" aria-label="Live customer chat messages">
            {liveChatRecords.map((record) => {
              const isIncoming = record.nextAction === "Incoming customer message";

              return (
                <div className={`chat-message ${isIncoming ? "incoming" : "outgoing"}`} key={record.id}>
                  <div className="chat-bubble">
                    <p>{record.message}</p>
                  </div>
                  <small>
                    {isIncoming
                      ? `From: ${record.senderPhone || record.customer}`
                      : `To: ${record.customer}`}{" "}
                    · {record.customer} - {record.component} ·{" "}
                    {record.channel}
                  </small>
                </div>
              );
            })}
            {!liveChatRecords.length && <div className="empty-filter">No live WhatsApp messages yet.</div>}
          </div>

          <form className="chat-composer" onSubmit={handleChatReplySubmit}>
            {chatStatus && <div className="form-alert chat-status">{chatStatus}</div>}
            <input
              className="content-sid-input"
              onChange={(event) => setChatToNumber(event.target.value)}
              placeholder={`WhatsApp recipient, e.g. ${replyTarget?.phone || "+91 9488245586"}`}
              value={chatToNumber}
            />
            <input
              onChange={(event) => setChatMessage(event.target.value)}
              placeholder={replyTarget ? `Type reply to ${replyTarget.customer}` : "Wait for a WhatsApp message or select a customer"}
              value={chatMessage}
            />
            <button className="primary-action" disabled={!replyTarget || !chatMessage.trim()} type="submit">
              Queue Reply
            </button>
          </form>
        </div>

        <aside className="ai-assistant-panel">
          <div className="chatbox-header">
            <div>
              <h2>Requirement Assistant</h2>
              <p>Extract the latest customer need and prepare the enquiry form.</p>
            </div>
            <span className="badge">Smart</span>
          </div>
          <div className="ai-analysis-body">
            <div className="ai-notes-preview">
              <span>Latest Customer Requirement</span>
              <p>{visibleChatTranscript || "No clear requirement message found yet."}</p>
            </div>
            <button className="primary-action" onClick={analyzeRequirement} type="button">
              Analyze Requirement
            </button>
            {!aiDraft && <div className="empty-filter">Receive a customer requirement in WhatsApp, then analyze it here.</div>}
            {aiDraft && (
              <>
                <div className="ai-summary-card">
                  <span>Result</span>
                  <strong>{aiDraft.requirementSummary}</strong>
                  <small>Confidence: {aiDraft.confidence}</small>
                </div>
                <div className="ai-draft-grid">
                  <div><span>Customer</span><strong>{aiDraft.customer || "Unknown"}</strong></div>
                  <div><span>Budget Range</span><strong>{aiDraft.budget}</strong></div>
                  <div><span>Component Unit Price</span><strong>{aiDraft.value || "0"}</strong></div>
                  <div><span>Phone Number</span><strong>{aiDraft.phone || "No phone"}</strong></div>
                  <div><span>Email</span><strong>{aiDraft.email || "No email detected"}</strong></div>
                  <div><span>Quantity</span><strong>{aiDraft.quantity || "Not mentioned"}</strong></div>
                  <div><span>Preferred Specification</span><strong>{aiDraft.color || "Any"}</strong></div>
                  <div><span>Component Name</span><strong>{aiDraft.contact || "Not detected"}</strong></div>
                  <div><span>Payment Type</span><strong>{aiDraft.paymentType}</strong></div>
                  <div><span>Enquiry Source</span><strong>{aiDraft.source}</strong></div>
                  <div><span>Requirement Discussion</span><strong>{aiDraft.followup}</strong></div>
                </div>
                <div className="ai-notes-preview">
                  <span>Notes</span>
                  <p>{aiDraft.notes}</p>
                </div>
                <button className="primary-action" onClick={applyAiDraft} type="button">
                  Fill Add Enquiry Form
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default App;
