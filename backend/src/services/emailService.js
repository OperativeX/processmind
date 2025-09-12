const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initialized = false;
  }

  /**
   * Initialize email service with configuration
   */
  async initialize() {
    try {
      const provider = process.env.EMAIL_PROVIDER;
      
      if (!provider) {
        logger.warn('No email provider configured. Emails will not be sent.');
        return;
      }

      switch (provider.toLowerCase()) {
        case 'smtp':
          await this.initializeSMTP();
          break;
        case 'console':
          await this.initializeConsole();
          break;
        case 'sendgrid':
          await this.initializeSendGrid();
          break;
        case 'ses':
          await this.initializeAWSSES();
          break;
        default:
          logger.error(`Unknown email provider: ${provider}`);
          return;
      }

      // Load email templates
      await this.loadTemplates();
      
      this.initialized = true;
      logger.info(`Email service initialized with provider: ${provider}`);
      
    } catch (error) {
      logger.error('Email service initialization error:', error);
      this.initialized = false;
    }
  }

  /**
   * Initialize SMTP transport
   */
  async initializeSMTP() {
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      // Extended timeout settings
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      // Enable debug logging in development
      logger: process.env.NODE_ENV === 'development',
      debug: process.env.NODE_ENV === 'development',
      // TLS settings for various providers
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
        minVersion: 'TLSv1.2',
        ciphers: 'SSLv3'
      }
    };

    // Validate configuration
    if (!config.host || !config.auth.user || !config.auth.pass) {
      throw new Error('SMTP configuration incomplete. Please check your .env file.');
    }

    logger.info('Creating SMTP transporter with config:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      from: process.env.SMTP_FROM || config.auth.user
    });

    this.transporter = nodemailer.createTransport(config);

    // Verify connection with extended timeout
    try {
      logger.info('Verifying SMTP connection...');
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      // Don't throw - allow service to start but log the error
      logger.warn('Email service will start but may not be able to send emails');
    }
  }

  /**
   * Initialize console email provider (for development)
   */
  async initializeConsole() {
    logger.info('Email service initialized with console provider (development mode)');
    this.transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n' + '='.repeat(80));
        console.log('EMAIL OUTPUT (Console Provider)');
        console.log('='.repeat(80));
        console.log(`To: ${mailOptions.to}`);
        console.log(`From: ${mailOptions.from}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log('-'.repeat(80));
        if (mailOptions.text) {
          console.log('Text Content:');
          console.log(mailOptions.text);
        }
        if (mailOptions.html) {
          console.log('\nHTML Content Preview:');
          // Simple HTML to text conversion for console
          const textPreview = mailOptions.html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);
          console.log(textPreview + (textPreview.length >= 500 ? '...' : ''));
        }
        console.log('='.repeat(80) + '\n');
        
        return { messageId: `console-${Date.now()}@processlink.local` };
      }
    };
  }

  /**
   * Initialize SendGrid (placeholder)
   */
  async initializeSendGrid() {
    // TODO: Implement SendGrid integration
    throw new Error('SendGrid integration not yet implemented');
  }

  /**
   * Initialize AWS SES (placeholder)
   */
  async initializeAWSSES() {
    // TODO: Implement AWS SES integration
    throw new Error('AWS SES integration not yet implemented');
  }

  /**
   * Load email templates from files
   */
  async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/emails');
    
    try {
      // Create templates directory if it doesn't exist
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Load verification template
      const verificationPath = path.join(templatesDir, 'verification.html');
      if (await this.fileExists(verificationPath)) {
        this.templates.verification = await fs.readFile(verificationPath, 'utf-8');
      } else {
        // Use default template if file doesn't exist
        this.templates.verification = this.getDefaultVerificationTemplate();
      }
      
      // Load password reset template
      const passwordResetPath = path.join(templatesDir, 'passwordReset.html');
      if (await this.fileExists(passwordResetPath)) {
        this.templates.passwordReset = await fs.readFile(passwordResetPath, 'utf-8');
      } else {
        this.templates.passwordReset = this.getDefaultPasswordResetTemplate();
      }
      
      // Load welcome template
      const welcomePath = path.join(templatesDir, 'welcome.html');
      if (await this.fileExists(welcomePath)) {
        this.templates.welcome = await fs.readFile(welcomePath, 'utf-8');
      } else {
        this.templates.welcome = this.getDefaultWelcomeTemplate();
      }
      
      // Load list share template
      const listSharePath = path.join(templatesDir, 'listShare.html');
      if (await this.fileExists(listSharePath)) {
        this.templates.listShare = await fs.readFile(listSharePath, 'utf-8');
      } else {
        this.templates.listShare = this.getDefaultListShareTemplate();
      }
      
      // Load account deletion template
      const accountDeletionPath = path.join(templatesDir, 'accountDeletion.html');
      if (await this.fileExists(accountDeletionPath)) {
        this.templates.accountDeletion = await fs.readFile(accountDeletionPath, 'utf-8');
      } else {
        this.templates.accountDeletion = this.getDefaultAccountDeletionTemplate();
      }
      
      logger.info('Email templates loaded successfully');
      
    } catch (error) {
      logger.error('Error loading email templates:', error);
      // Use default templates on error
      this.templates.verification = this.getDefaultVerificationTemplate();
      this.templates.passwordReset = this.getDefaultPasswordResetTemplate();
      this.templates.welcome = this.getDefaultWelcomeTemplate();
      this.templates.listShare = this.getDefaultListShareTemplate();
      this.templates.accountDeletion = this.getDefaultAccountDeletionTemplate();
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to, code, options = {}) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send verification email.');
      return false;
    }

    try {
      const { firstName = 'User', tenantName = 'Process Mind' } = options;
      
      // Replace template variables
      const html = this.templates.verification
        .replace(/{{CODE}}/g, code)
        .replace(/{{FIRST_NAME}}/g, firstName)
        .replace(/{{TENANT_NAME}}/g, tenantName)
        .replace(/{{YEAR}}/g, new Date().getFullYear());

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject: `${tenantName} - E-Mail-Adresse bestätigen`,
        html,
        text: `Ihr Bestätigungscode lautet: ${code}`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Verification email sent successfully', {
        to,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending verification email:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to, resetToken, options = {}) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send password reset email.');
      return false;
    }

    try {
      const { firstName = 'User' } = options;
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      // Replace template variables
      const html = this.templates.passwordReset
        .replace(/{{RESET_URL}}/g, resetUrl)
        .replace(/{{FIRST_NAME}}/g, firstName)
        .replace(/{{YEAR}}/g, new Date().getFullYear());

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject: 'Passwort zurücksetzen - ProcessLink',
        html,
        text: `Setzen Sie Ihr Passwort zurück, indem Sie folgenden Link besuchen: ${resetUrl}`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Password reset email sent successfully', {
        to,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to, options = {}) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send welcome email.');
      return false;
    }

    try {
      const { firstName = 'User', tenantName = 'Process Mind' } = options;
      const loginUrl = `${process.env.FRONTEND_URL}/login`;
      
      // Replace template variables
      const html = this.templates.welcome
        .replace(/{{FIRST_NAME}}/g, firstName)
        .replace(/{{TENANT_NAME}}/g, tenantName)
        .replace(/{{LOGIN_URL}}/g, loginUrl)
        .replace(/{{YEAR}}/g, new Date().getFullYear());

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject: `Willkommen bei ${tenantName}!`,
        html,
        text: `Willkommen bei ${tenantName}! Beginnen Sie, indem Sie sich anmelden unter: ${loginUrl}`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Welcome email sent successfully', {
        to,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Send list share email
   */
  async sendListShareEmail(to, options = {}) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send list share email.');
      return false;
    }

    try {
      const { 
        recipientName = 'User',
        senderName,
        listName,
        listDescription = '',
        processCount = 0,
        message = '',
        pendingShareId,
        tenantName = 'Process Mind'
      } = options;
      
      // Generate accept/reject URLs
      const baseUrl = process.env.FRONTEND_URL;
      const acceptUrl = `${baseUrl}/accept-share/${pendingShareId}`;
      const rejectUrl = `${baseUrl}/reject-share/${pendingShareId}`;
      
      // Format message section
      const messageSection = message ? 
        `<div class="message-box">
          <strong>Persönliche Nachricht:</strong><br>
          "${message}"
        </div>` : '';
      
      // Format description
      const descriptionHtml = listDescription ? 
        `<p style="margin: 10px 0;">${listDescription}</p>` : '';
      
      // Replace template variables
      const html = this.templates.listShare
        .replace(/{{RECIPIENT_NAME}}/g, recipientName)
        .replace(/{{SENDER_NAME}}/g, senderName)
        .replace(/{{LIST_NAME}}/g, listName)
        .replace(/{{LIST_DESCRIPTION}}/g, descriptionHtml)
        .replace(/{{PROCESS_COUNT}}/g, processCount)
        .replace(/{{MESSAGE_SECTION}}/g, messageSection)
        .replace(/{{ACCEPT_URL}}/g, acceptUrl)
        .replace(/{{REJECT_URL}}/g, rejectUrl)
        .replace(/{{TENANT_NAME}}/g, tenantName)
        .replace(/{{YEAR}}/g, new Date().getFullYear());

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject: `${senderName} hat eine Favoriten-Liste mit Ihnen geteilt`,
        html,
        text: `${senderName} hat die Liste "${listName}" mit Ihnen geteilt. ${message ? `Nachricht: ${message}` : ''}`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('List share email sent successfully', {
        to,
        listName,
        pendingShareId,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending list share email:', error);
      return false;
    }
  }

  /**
   * Send account deletion email
   */
  async sendAccountDeletionEmail(to, options = {}) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send account deletion email.');
      return false;
    }

    try {
      const { firstName = 'Benutzer', tenantName = 'ProcessLink' } = options;
      
      // Replace template variables
      const html = this.templates.accountDeletion
        .replace(/{{FIRST_NAME}}/g, firstName)
        .replace(/{{TENANT_NAME}}/g, tenantName)
        .replace(/{{YEAR}}/g, new Date().getFullYear());

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`
,
        to,
        subject: `${tenantName} - Ihr Konto wurde gelöscht`,
        html,
        text: `Hallo ${firstName},\n\nIhr Konto bei ${tenantName} wurde gemäß Ihrer Anfrage erfolgreich gelöscht. Alle Ihre Daten wurden unwiderruflich aus unseren Systemen entfernt.\n\nVielen Dank, dass Sie ProcessLink genutzt haben.`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Account deletion email sent successfully', {
        to,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending account deletion email:', error);
      return false;
    }
  }

  /**
   * Send custom email
   */
  async sendEmail(to, subject, html, text) {
    if (!this.initialized) {
      logger.warn('Email service not initialized. Cannot send email.');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Custom email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error sending custom email:', error);
      return false;
    }
  }

  /**
   * Default verification email template
   */
  getDefaultVerificationTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Mail-Adresse bestätigen</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #7c3aed; color: #ffffff; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .code-box { background-color: #f8f4ff; border: 2px solid #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
    .code { font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 5px; }
    .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
    a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{TENANT_NAME}}</h1>
      <p>E-Mail-Bestätigung</p>
    </div>
    <div class="content">
      <h2>Hallo {{FIRST_NAME}},</h2>
      <p>Vielen Dank für Ihre Registrierung bei {{TENANT_NAME}}. Um Ihre Registrierung abzuschließen, verwenden Sie bitte den folgenden Bestätigungscode:</p>
      <div class="code-box">
        <div class="code">{{CODE}}</div>
      </div>
      <p>Dieser Code ist aus Sicherheitsgründen nur 10 Minuten gültig.</p>
      <p>Falls Sie diese Bestätigung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
    </div>
    <div class="footer">
      <p>&copy; {{YEAR}} {{TENANT_NAME}}. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Default password reset email template
   */
  getDefaultPasswordResetTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Passwort zurücksetzen</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #7c3aed; color: #ffffff; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .button { display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ProcessLink</h1>
      <p>Passwort-Zurücksetzung</p>
    </div>
    <div class="content">
      <h2>Hallo {{FIRST_NAME}},</h2>
      <p>Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort zu erstellen:</p>
      <p style="text-align: center;">
        <a href="{{RESET_URL}}" class="button">Passwort zurücksetzen</a>
      </p>
      <p>Dieser Link ist aus Sicherheitsgründen nur 1 Stunde gültig.</p>
      <p>Falls Sie keine Passwort-Zurücksetzung angefordert haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.</p>
      <p><small>Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link und fügen Sie ihn in Ihren Browser ein:<br>{{RESET_URL}}</small></p>
    </div>
    <div class="footer">
      <p>&copy; {{YEAR}} ProcessLink. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Default welcome email template
   */
  getDefaultWelcomeTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Willkommen bei {{TENANT_NAME}}</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #7c3aed; color: #ffffff; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .button { display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .features { background-color: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Willkommen bei {{TENANT_NAME}}!</h1>
    </div>
    <div class="content">
      <h2>Hallo {{FIRST_NAME}},</h2>
      <p>Willkommen bei {{TENANT_NAME}}! Ihr Konto wurde erfolgreich erstellt und Sie können jetzt unsere leistungsstarken Funktionen für Videoverarbeitung und KI-Analyse nutzen.</p>
      
      <div class="features">
        <h3>Was Sie mit ProcessLink machen können:</h3>
        <ul>
          <li>Videos mit KI-gestützter Transkription hochladen und verarbeiten</li>
          <li>Automatisch Tags und Aufgabenlisten aus Ihren Inhalten generieren</li>
          <li>Verbindungen zwischen Ihren Prozessen visualisieren</li>
          <li>Mit Ihrem Team teilen und zusammenarbeiten</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="{{LOGIN_URL}}" class="button">Jetzt starten</a>
      </p>
      
      <p>Falls Sie Fragen haben oder Unterstützung benötigen, zögern Sie nicht, unser Support-Team zu kontaktieren.</p>
    </div>
    <div class="footer">
      <p>&copy; {{YEAR}} {{TENANT_NAME}}. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Default list share email template
   */
  getDefaultListShareTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eine Favoriten-Liste wurde mit Ihnen geteilt</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #7c3aed; color: #ffffff; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .list-info { background-color: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
    .message-box { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; font-style: italic; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-weight: bold; }
    .button-accept { background-color: #10b981; color: #ffffff; }
    .button-reject { background-color: #ef4444; color: #ffffff; }
    .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
    .info-text { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{TENANT_NAME}}</h1>
      <p>Neue Favoriten-Liste geteilt</p>
    </div>
    <div class="content">
      <h2>Hallo {{RECIPIENT_NAME}},</h2>
      <p><strong>{{SENDER_NAME}}</strong> hat eine Favoriten-Liste mit Ihnen geteilt:</p>
      
      <div class="list-info">
        <h3 style="margin-top: 0; color: #7c3aed;">{{LIST_NAME}}</h3>
        {{LIST_DESCRIPTION}}
        <p style="margin-bottom: 0;"><strong>Anzahl Prozesse:</strong> {{PROCESS_COUNT}}</p>
      </div>
      
      {{MESSAGE_SECTION}}
      
      <div class="button-container">
        <a href="{{ACCEPT_URL}}" class="button button-accept">Liste annehmen</a>
        <a href="{{REJECT_URL}}" class="button button-reject">Ablehnen</a>
      </div>
      
      <p class="info-text">
        Wenn Sie diese Liste annehmen, wird eine Kopie in Ihren Favoriten erstellt. Sie können die Liste dann bearbeiten, ohne die Original-Liste zu beeinflussen.
      </p>
      
      <p class="info-text">
        Diese Einladung läuft in 30 Tagen ab. Sie können sich auch in Ihrem Account einloggen und die Einladung dort verwalten.
      </p>
    </div>
    <div class="footer">
      <p>&copy; {{YEAR}} {{TENANT_NAME}}. Alle Rechte vorbehalten.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Default account deletion email template
   */
  getDefaultAccountDeletionTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konto gelöscht</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #7c3aed; color: #ffffff; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .info-box { background-color: #f8f4ff; border: 1px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
    a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{TENANT_NAME}}</h1>
      <p>Konto-Löschung bestätigt</p>
    </div>
    <div class="content">
      <h2>Hallo {{FIRST_NAME}},</h2>
      <p>Ihr Konto bei {{TENANT_NAME}} wurde gemäß Ihrer Anfrage erfolgreich gelöscht.</p>
      <div class="info-box">
        <h3>Was wurde gelöscht:</h3>
        <ul>
          <li>Ihr Benutzerkonto und alle persönlichen Daten</li>
          <li>Alle hochgeladenen Videos und Verarbeitungen</li>
          <li>Alle erstellten Sammlungen und Favoriten</li>
          <li>Ihre Team-Mitgliedschaften und Einstellungen</li>
        </ul>
      </div>
      <p>Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.</p>
      <p>Falls Sie Fragen haben, kontaktieren Sie uns unter <a href="mailto:support@processlink.de">support@processlink.de</a></p>
    </div>
    <div class="footer">
      <p>&copy; {{YEAR}} {{TENANT_NAME}}. Vielen Dank, dass Sie ProcessLink genutzt haben.</p>
    </div>
  </div>
</body>
</html>`;
  }
}

// Export singleton instance
module.exports = new EmailService();