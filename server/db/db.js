import sql from 'mssql/msnodesqlv8.js';
import dotenv from 'dotenv';
dotenv.config();

const dbServer = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
const dbDatabase = process.env.DB_DATABASE || 'NexusAIDB';
const dbUser = process.env.DB_USER || '';
const dbPassword = process.env.DB_PASSWORD || '';
const isTrusted = process.env.DB_TRUSTED_CONNECTION === 'true' || !dbUser;

let pool = null;

export async function getDbPool() {
  if (pool) return pool;

  let config;
  if (isTrusted) {
    // Windows Authentication using ODBC Driver 18 for local SQLEXPRESS
    config = {
      connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${dbServer};Database=${dbDatabase};Trusted_Connection=yes;TrustServerCertificate=yes;`,
    };
  } else {
    // SQL Server Authentication with user/password
    config = {
      server: dbServer,
      database: dbDatabase,
      user: dbUser,
      password: dbPassword,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };
  }

  try {
    pool = await sql.connect(config);
    console.log(`[Database] Connected to SQL Server (${dbServer}, DB: ${dbDatabase}) successfully.`);
    await initDb(pool);
    return pool;
  } catch (err) {
    console.error(`[Database] Error connecting to database '${dbDatabase}':`, err.message);

    // If the database doesn't exist yet, connect to 'master' to create it automatically
    if (err.message && err.message.includes('Cannot open database')) {
      console.log(`[Database] Database '${dbDatabase}' does not exist. Creating it now...`);
      try {
        const masterConn = isTrusted
          ? `Driver={ODBC Driver 18 for SQL Server};Server=${dbServer};Database=master;Trusted_Connection=yes;TrustServerCertificate=yes;`
          : { ...config, database: 'master' };
        
        const masterPool = await sql.connect(masterConn);
        await masterPool.query(`CREATE DATABASE [${dbDatabase}];`);
        await masterPool.close();
        console.log(`[Database] Database '${dbDatabase}' created successfully.`);

        // Reconnect to newly created database
        pool = await sql.connect(config);
        await initDb(pool);
        return pool;
      } catch (createErr) {
        console.error('[Database] Failed to auto-create database:', createErr.message);
        throw createErr;
      }
    }
    throw err;
  }
}

/**
 * Ensure Users, Conversations, and Messages tables exist with proper constraints and indexes
 */
async function initDb(dbPool) {
  const schemaSql = `
    -- 1. Users Table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    BEGIN
      CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      );
      PRINT 'Users table created successfully.';
    END

    -- 2. Conversations Table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Conversations' AND xtype='U')
    BEGIN
      CREATE TABLE Conversations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES Users(id) ON DELETE CASCADE,
        title NVARCHAR(255) NOT NULL DEFAULT 'New Chat',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
      CREATE INDEX IX_Conversations_user_id ON Conversations(user_id);
      PRINT 'Conversations table created successfully.';
    END

    -- 3. Messages Table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' AND xtype='U')
    BEGIN
      CREATE TABLE Messages (
        id INT IDENTITY(1,1) PRIMARY KEY,
        conversation_id INT NOT NULL FOREIGN KEY REFERENCES Conversations(id) ON DELETE CASCADE,
        role NVARCHAR(50) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
      );
      CREATE INDEX IX_Messages_conversation_id ON Messages(conversation_id);
      PRINT 'Messages table created successfully.';
    END
  `;
  await dbPool.query(schemaSql);
  console.log('[Database] Database tables and indexes verified.');
}

export { sql };
