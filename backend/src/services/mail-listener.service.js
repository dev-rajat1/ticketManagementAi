import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '../config/database.js';
import ticketService from './ticket.service.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');

class MailListenerService {
  constructor() {
    this.client = new ImapFlow({
      host: process.env.IMAP_HOST,
      port: parseInt(process.env.IMAP_PORT, 10) || 993,
      secure: true,
      auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS
      },
      logger: false
    });
    this.isProcessing = false;
  }

  async start() {
    console.log('📬 Email Listener service initialized.');
    this.processEmails();
    setInterval(() => {
      if (!this.isProcessing) this.processEmails();
    }, 60000);
  }

  async processEmails() {
    this.isProcessing = true;
    try {
      if (!this.client.usable) await this.client.connect();

      let lock = await this.client.getMailboxLock('INBOX');
      try {
        const uids = await this.client.search({ seen: false });
        if (!uids || uids.length === 0) return;

        for (const uid of uids) {
          try {
            const message = await this.client.fetchOne(uid, { source: true });
            if (!message) continue;

            const parsed = await simpleParser(message.source);
            const fromEmail = parsed.from?.value[0]?.address.toLowerCase();
            if (!fromEmail) continue;

            // ── No-reply / Automated sender filter ──────────────────────────
            // Yeh addresses reply accept nahi karte — skip karo taaki bounce na aaye
            const BLOCKED_PATTERNS = [
              /^no-?reply@/i,
              /^donotreply@/i,
              /^do-not-reply@/i,
              /^noreply@/i,
              /^mailer-daemon@/i,
              /^postmaster@/i,
              /^bounce[s]?@/i,
              /^auto(mated)?[-.]?(reply|response|message)?@/i,
              /^notifications?@/i,
              /^alerts?@/i,
              /^system@/i,
            ];

            const isBlockedSender = BLOCKED_PATTERNS.some(pattern => pattern.test(fromEmail));

            // Email ko "seen" mark kar do taaki baar baar process na ho
            if (isBlockedSender) {
              await this.client.messageFlagsAdd(uid, ['\\Seen']);
              console.log(`⏭️  Skipped automated/no-reply email from: ${fromEmail}`);
              continue;
            }
            // ────────────────────────────────────────────────────────────────

            // 1. User Logic
            let user = await prisma.user.findUnique({ where: { email: fromEmail } });
            if (!user) {
              user = await prisma.user.create({
                data: {
                  email: fromEmail,
                  name: parsed.from.value[0].name || fromEmail.split('@')[0],
                  role: 'USER',
                  passwordHash: await bcrypt.hash(uuidv4(), 10),
                }
              });
            }

            // 2. Handle Ticket/Comment Creation
            let targetTicketId = null;
            const ticketMatch = (parsed.subject || '').match(/\[(TKT-\d+)\]/i);
            
            if (ticketMatch) {
              const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: ticketMatch[1].toUpperCase() } });
              if (ticket) {
                await ticketService.addComment(ticket.id, parsed.text || 'No text content', user.id);
                targetTicketId = ticket.id;
              }
            }

            if (!targetTicketId) {
              const newTicket = await ticketService.create({
                subject: parsed.subject || 'No Subject',
                description: parsed.text || 'No content',
                category: 'General'
              }, user.id);
              targetTicketId = newTicket.id;
            }

            // 3. PROCESS ATTACHMENTS
            if (parsed.attachments && parsed.attachments.length > 0) {
              console.log(`📎 Processing ${parsed.attachments.length} attachments for ticket...`);
              for (const att of parsed.attachments) {
                const uniqueName = `${Date.now()}-${att.filename}`;
                const filePath = path.join(uploadsDir, uniqueName);
                
                await fs.writeFile(filePath, att.content);
                
                await ticketService.addAttachment(targetTicketId, {
                  filename: uniqueName,
                  originalname: att.filename,
                  mimetype: att.contentType,
                  size: att.size,
                  fileUrl: `/uploads/${uniqueName}`
                }, user.id);
              }
            }

            await this.client.messageFlagsAdd(uid, ['\\Seen']);
            console.log(`✅ Processed email from ${fromEmail}`);

          } catch (msgErr) {
            console.error(`❌ Msg Error:`, msgErr.message);
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error('❌ IMAP Error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }
}

export default new MailListenerService();
