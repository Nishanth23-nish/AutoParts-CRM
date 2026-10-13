CREATE DATABASE IF NOT EXISTS autoforge_crm;
USE autoforge_crm;

CREATE TABLE IF NOT EXISTS component_enquiries (
  id BIGINT PRIMARY KEY,
  customer VARCHAR(120) NOT NULL,
  contact VARCHAR(120) NOT NULL,
  stage VARCHAR(40) NOT NULL,
  followup VARCHAR(40) NOT NULL,
  value INT NOT NULL DEFAULT 0,
  month VARCHAR(20) NOT NULL DEFAULT 'Sep',
  phone VARCHAR(40),
  email VARCHAR(120),
  color VARCHAR(60),
  budget VARCHAR(40),
  paymentType VARCHAR(40),
  paymentStatus VARCHAR(40),
  amountPaid INT NOT NULL DEFAULT 0,
  paymentReference VARCHAR(120),
  paymentDueDate VARCHAR(40),
  source VARCHAR(40),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS component_inventory (
  id BIGINT PRIMARY KEY,
  model VARCHAR(120) NOT NULL,
  variant VARCHAR(120) NOT NULL,
  price INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  colors VARCHAR(255),
  status VARCHAR(40) NOT NULL DEFAULT 'Available',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_history (
  id BIGINT PRIMARY KEY,
  enquiryId BIGINT NOT NULL,
  customer VARCHAR(120) NOT NULL,
  component VARCHAR(120) NOT NULL,
  channel VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  nextAction VARCHAR(80) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
