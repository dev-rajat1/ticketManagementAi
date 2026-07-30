import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT, 10) || 2525,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    this.brandColor = '#4F46E5';
    // Updated logo to a more modern support/AI related icon
    this.logoUrl = 'https://img.icons8.com/fluency/96/customer-support.png';
    this.replyMarker = '--- Reply above this line ---';
  }

  #getThreadHeaders(ticketNumber) {
    const domain = process.env.EMAIL_FROM?.split('@')[1] || 'smartsupport.internal';
    const messageId = `<${ticketNumber}@${domain}>`;
    return {
      'In-Reply-To': messageId,
      'References': messageId
    };
  }

  #getStatusColor(status) {
    const colors = {
      'OPEN': '#10b981',
      'IN_PROGRESS': '#3b82f6',
      'RESOLVED': '#6366f1',
      'CLOSED': '#6b7280',
      'WAITING': '#f59e0b'
    };
    return colors[status] || this.brandColor;
  }

  #getBaseTemplate(content, title, preheader = '') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
          .wrapper { width: 100%; background-color: #f4f7fa; padding-bottom: 40px; }
          .main { background-color: #ffffff; margin: 20px auto; width: 100%; max-width: 600px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .marker { color: #9ca3af; font-size: 11px; text-align: center; padding: 10px 0; }
          .header { background-color: ${this.brandColor}; padding: 32px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
          .logo { margin-bottom: 15px; width: 64px; height: 64px; }
          .content { padding: 40px 32px; line-height: 1.6; color: #374151; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #ffffff; text-transform: uppercase; }
          .ticket-info { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0; }
          .footer { text-align: center; padding: 32px; font-size: 12px; color: #6b7280; }
          .button { background-color: ${this.brandColor}; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="marker">${this.replyMarker}</div>
        <div class="wrapper">
          <table class="main" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td class="header">
                <img src="${this.logoUrl}" class="logo" alt="SmartSupport Logo"><br>
                <h1>SmartSupport</h1>
              </td>
            </tr>
            <tr>
              <td class="content">
                <div style="display:none;font-size:1px;">${preheader}</div>
                ${content}
              </td>
            </tr>
            <tr>
              <td class="footer">
                <p>This is an automated notification. Track your tickets at <a href="${process.env.CLIENT_URL}" style="color: ${this.brandColor}; text-decoration: none;">Help Center</a></p>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  async sendWelcome(user) {
    const html = this.#getBaseTemplate(`
      <h2 style="margin-top:0;">Welcome, ${user.name}!</h2>
      <p>Your support account has been created. You can now manage all your requests in our portal or simply reply to our emails.</p>
      <div style="text-align: center; margin-top: 32px;">
        <a href="${process.env.CLIENT_URL}/login" class="button">Access Dashboard</a>
      </div>
    `, 'Welcome to SmartSupport', 'Account successfully created');

    return this.transporter.sendMail({
      from: `"SmartSupport" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: 'Welcome to SmartSupport',
      html
    });
  }

  async sendTicketUpdate(user, ticket, updateType) {
    const statusColor = this.#getStatusColor(ticket.status);
    const html = this.#getBaseTemplate(`
      <h2 style="margin-top:0;">Ticket Update: #${ticket.ticketNumber}</h2>
      <p>Hello ${user.name}, your ticket "<b>${ticket.subject}</b>" has been updated.</p>
      
      <div class="ticket-info">
        <p><span style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase;">Status:</span><br>
        <span class="badge" style="background-color: ${statusColor};">${ticket.status}</span></p>
        <p><span style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase;">Latest Update:</span><br>
        <span style="font-weight: 600;">${updateType}</span></p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/tickets/${ticket.id}" class="button">View Full History</a>
      </div>
    `, `Update: ${ticket.ticketNumber}`, `Update on ticket ${ticket.ticketNumber}`);

    return this.transporter.sendMail({
      from: `"SmartSupport" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `[${ticket.ticketNumber}] Update: ${ticket.subject}`,
      html,
      headers: this.#getThreadHeaders(ticket.ticketNumber)
    });
  }

  async sendCommentNotification(user, ticket, comment) {
    const html = this.#getBaseTemplate(`
      <h2 style="margin-top:0;">New Message Received</h2>
      <p>Hi ${user.name}, a support agent has replied to your ticket <b>${ticket.ticketNumber}</b>:</p>
      
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <div style="white-space: pre-wrap; font-size: 14px;">${comment.content}</div>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.CLIENT_URL}/tickets/${ticket.id}" class="button">Post a Reply</a>
      </div>
    `, `New Reply: ${ticket.ticketNumber}`, `New comment on ${ticket.ticketNumber}`);

    return this.transporter.sendMail({
      from: `"SmartSupport" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
      html,
      headers: this.#getThreadHeaders(ticket.ticketNumber)
    });
  }
}

export default new EmailService();
