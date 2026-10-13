import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const databaseName = process.env.DB_NAME || "autoforge_crm";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10
});

export async function initializeDatabase() {
  const setupConnection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || ""
  });

  const safeDatabaseName = databaseName.replace(/`/g, "``");
  await setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${safeDatabaseName}\``);
  await setupConnection.end();

  await pool.query(`
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
    )
  `);

  await ensureColumn("component_enquiries", "paymentStatus", "VARCHAR(40)");
  await ensureColumn("component_enquiries", "amountPaid", "INT NOT NULL DEFAULT 0");
  await ensureColumn("component_enquiries", "paymentReference", "VARCHAR(120)");
  await ensureColumn("component_enquiries", "paymentDueDate", "VARCHAR(40)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS component_inventory (
      id BIGINT PRIMARY KEY,
      model VARCHAR(120) NOT NULL,
      variant VARCHAR(120) NOT NULL,
      price INT NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      colors VARCHAR(255),
      status VARCHAR(40) NOT NULL DEFAULT 'Available',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS communication_history (
      id BIGINT PRIMARY KEY,
      enquiryId BIGINT NOT NULL,
      customer VARCHAR(120) NOT NULL,
      component VARCHAR(120) NOT NULL,
      channel VARCHAR(40) NOT NULL,
      message TEXT NOT NULL,
      nextAction VARCHAR(80) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_whatsapp_replies (
      phone VARCHAR(60) PRIMARY KEY,
      message TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureColumn(tableName, columnName, columnDefinition) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [databaseName, tableName, columnName]
  );

  if (!rows.length) {
    const safeTableName = tableName.replace(/`/g, "``");
    const safeColumnName = columnName.replace(/`/g, "``");
    await pool.query(`ALTER TABLE \`${safeTableName}\` ADD COLUMN \`${safeColumnName}\` ${columnDefinition}`);
  }
}
