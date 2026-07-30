import prisma from '../config/database.js';
import emailService from './email.service.js';
import aiService from './ai.service.js';
import { CATEGORY_KEYWORDS, PRIORITY_KEYWORDS, SENTIMENT_KEYWORDS } from '../utils/constants.js';

/**
 * @class TicketService
 */
class TicketService {
  static USER_SELECT = {
    id: true,
    name: true,
    email: true,
  };

  async #generateTicketNumber() {
    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true }
    });

    let nextNum = 1;
    if (lastTicket && lastTicket.ticketNumber) {
      const lastNum = parseInt(lastTicket.ticketNumber.replace('TKT-', ''), 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    
    return `TKT-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * Helper to calculate the best match score for a set of keywords
   * Returns the key with the highest number of matches.
   */
  #findBestMatch(text, keywordMap, defaultVal) {
    const content = text.toLowerCase();
    let bestMatch = defaultVal;
    let maxScore = 0;

    for (const [key, keywords] of Object.entries(keywordMap)) {
      let currentScore = 0;
      keywords.forEach(word => {
        // Use regex to match whole words only for higher accuracy
        const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'g');
        const count = (content.match(regex) || []).length;
        currentScore += count;
      });

      if (currentScore > maxScore) {
        maxScore = currentScore;
        bestMatch = key;
      }
    }
    return bestMatch;
  }

  #autoDetectCategory(subject, description) {
    return this.#findBestMatch(`${subject} ${description}`, CATEGORY_KEYWORDS, 'General Inquiry');
  }

  #autoDetectPriority(subject, description) {
    // For priority, we also weigh CRITICAL and HIGH slightly more to be safe
    const content = `${subject} ${description}`.toLowerCase();
    let bestMatch = 'MEDIUM';
    let maxScore = 0;

    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      let currentScore = 0;
      keywords.forEach(word => {
        const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'g');
        currentScore += (content.match(regex) || []).length;
      });

      // Weighting: Critical and High get a small boost if found
      if (priority === 'CRITICAL' && currentScore > 0) currentScore += 0.5;
      if (priority === 'HIGH' && currentScore > 0) currentScore += 0.2;

      if (currentScore > maxScore) {
        maxScore = currentScore;
        bestMatch = priority;
      }
    }
    return bestMatch;
  }

  #autoDetectSentiment(description) {
    return this.#findBestMatch(description, SENTIMENT_KEYWORDS, 'neutral');
  }

  /**
   * Creates a new ticket
   */
  async create(data, userId) {
    const ticketNumber = await this.#generateTicketNumber();
    
    // Accurate Keyword-based detection
    const category = (!data.category || data.category === 'General' || data.category === 'General Inquiry')
      ? this.#autoDetectCategory(data.subject, data.description)
      : data.category;

    const priority = data.priority || this.#autoDetectPriority(data.subject, data.description);
    const sentiment = this.#autoDetectSentiment(data.description);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        description: data.description,
        priority: priority,
        category: category,
        aiSentiment: sentiment,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdById: userId,
        assignedToId: data.assignedToId || null,
      },
      include: {
        createdBy: { select: TicketService.USER_SELECT },
        assignedTo: { select: TicketService.USER_SELECT },
      },
    });

    emailService.sendTicketUpdate(ticket.createdBy, ticket, 'Ticket Created Successfully')
      .catch(err => console.error('Notification Email failed:', err.message));

    // AI is now ONLY used for Summary
    aiService.summarize(ticket.id).catch(err => 
      console.error('AI Summarization Error:', err.message)
    );

    return ticket;
  }

  async findAll(filters = {}) {
    let {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      assignedToId,
      createdById,
      search,
    } = filters;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where = { AND: [] };

    if (status) where.AND.push({ status });
    if (priority) where.AND.push({ priority });
    if (category) where.AND.push({ category });
    if (createdById) where.AND.push({ createdById });

    if (assignedToId !== undefined) {
      if (assignedToId === 'null' || assignedToId === '') {
        where.AND.push({ assignedToId: null });
      } else {
        where.AND.push({ assignedToId: assignedToId });
      }
    }

    if (search) {
      const searchTerm = search.trim();
      where.AND.push({
        OR: [
          { ticketNumber: { contains: searchTerm } },
          { subject: { contains: searchTerm } },
          { description: { contains: searchTerm } }
        ]
      });
    }

    const finalWhere = where.AND.length > 0 ? where : {};

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where: finalWhere,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: TicketService.USER_SELECT },
          assignedTo: { select: TicketService.USER_SELECT },
        },
      }),
      prisma.ticket.count({ where: finalWhere }),
    ]);

    return {
      tickets,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findById(id) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: TicketService.USER_SELECT },
        assignedTo: { select: TicketService.USER_SELECT },
        comments: {
          include: {
            user: { select: TicketService.USER_SELECT },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            user: { select: TicketService.USER_SELECT }
          },
          orderBy: { createdAt: 'desc' }
        },
        history: {
          include: {
            user: { select: TicketService.USER_SELECT },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(id, data, userId) {
    const currentTicket = await prisma.ticket.findUnique({ 
      where: { id },
      include: { createdBy: true, assignedTo: true }
    });
    if (!currentTicket) return null;

    const trackableFields = ['status', 'priority', 'category', 'assignedToId', 'subject', 'description', 'dueDate'];
    const historyEntries = [];
    const updateData = {};

    for (const field of trackableFields) {
      if (data[field] !== undefined) {
        const oldValue = currentTicket[field];
        let newValue = data[field];
        if (field === 'dueDate' && data[field]) newValue = new Date(data[field]);

        if (String(oldValue) !== String(newValue)) {
          let oldDisplayValue = oldValue ? String(oldValue) : 'none';
          let newDisplayValue = newValue ? String(newValue) : 'none';

          if (field === 'assignedToId') {
            oldDisplayValue = currentTicket.assignedTo?.name || 'none';
            if (newValue) {
              const newAgent = await prisma.user.findUnique({ where: { id: newValue }, select: { name: true } });
              newDisplayValue = newAgent?.name || 'none';
            } else {
              newDisplayValue = 'none';
            }
          }

          historyEntries.push({
            ticketId: id,
            fieldChanged: field,
            oldValue: oldDisplayValue,
            newValue: newDisplayValue,
            changedBy: userId,
          });
        }
        updateData[field] = newValue;
      }
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      if (historyEntries.length > 0) {
        await tx.ticketHistory.createMany({ data: historyEntries });
      }
      return tx.ticket.update({
        where: { id },
        data: updateData,
        include: {
          createdBy: { select: TicketService.USER_SELECT },
          assignedTo: { select: TicketService.USER_SELECT },
        },
      });
    });

    if (data.assignedToId && data.assignedToId !== currentTicket.assignedToId) {
      if (updatedTicket.assignedTo) {
        emailService.sendTicketUpdate(updatedTicket.assignedTo, updatedTicket, 'New ticket assigned to you')
          .catch(err => console.error('Assignment Email failed:', err.message));
      }
    }

    if (data.status && data.status !== currentTicket.status) {
      if (data.status === 'RESOLVED') {
        emailService.sendTicketResolved(updatedTicket.createdBy, updatedTicket)
          .catch(err => console.error('Resolution Email failed:', err.message));
      } else {
        emailService.sendTicketUpdate(updatedTicket.createdBy, updatedTicket, `Status updated to ${data.status}`)
          .catch(err => console.error('Status Update Email failed:', err.message));
      }
    }

    return updatedTicket;
  }

  async delete(id) {
    return prisma.ticket.delete({ where: { id } });
  }

  async addComment(ticketId, content, userId, isAiGenerated = false) {
    const comment = await prisma.comment.create({
      data: { content, ticketId, userId, isAiGenerated },
      include: { 
        user: { select: TicketService.USER_SELECT },
        ticket: { include: { createdBy: true, assignedTo: true } }
      },
    });

    if (comment.ticket.createdById !== userId) {
      emailService.sendCommentNotification(comment.ticket.createdBy, comment.ticket, comment)
        .catch(err => console.error('Comment Notification Email failed:', err.message));
    }

    return comment;
  }

  async addAttachment(ticketId, file, userId) {
    const filename = file.originalname || file.filename;
    const fileUrl = file.fileUrl || `/uploads/${file.filename}`;
    
    return prisma.attachment.create({
      data: {
        ticketId,
        uploadedBy: userId,
        filename: filename,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
      include: {
        user: { select: TicketService.USER_SELECT }
      }
    });
  }

  async deleteAttachment(ticketId, attachmentId) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId }
    });
    if (!attachment) {
      throw new Error('Attachment not found for this ticket');
    }
    return prisma.attachment.delete({
      where: { id: attachmentId }
    });
  }

  async getComments(ticketId) {
    return prisma.comment.findMany({
      where: { ticketId },
      include: { user: { select: TicketService.USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getHistory(ticketId) {
    return prisma.ticketHistory.findMany({
      where: { ticketId },
      include: { user: { select: TicketService.USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async bulkUpdateStatus(ticketIds, status, userId) {
    return await prisma.$transaction(async (tx) => {
      const tickets = await tx.ticket.findMany({
        where: { id: { in: ticketIds } },
        include: { createdBy: true }
      });

      const historyEntries = tickets.map(ticket => ({
        ticketId: ticket.id,
        fieldChanged: 'status',
        oldValue: ticket.status,
        newValue: status,
        changedBy: userId,
      }));

      if (historyEntries.length > 0) {
        await tx.ticketHistory.createMany({ data: historyEntries });
      }

      await tx.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { status },
      });

      tickets.forEach(t => {
        emailService.sendTicketUpdate(t.createdBy, { ...t, status }, `Status updated to ${status}`)
          .catch(() => {});
      });

      return tickets.length;
    });
  }

  async bulkAssign(ticketIds, assignedToId, userId) {
    return await prisma.$transaction(async (tx) => {
      const tickets = await tx.ticket.findMany({
        where: { id: { in: ticketIds } },
        include: { assignedTo: true }
      });

      let newAgentName = 'none';
      if (assignedToId) {
        const agent = await tx.user.findUnique({ where: { id: assignedToId }, select: { name: true } });
        newAgentName = agent?.name || 'none';
      }

      const historyEntries = tickets.map(ticket => ({
        ticketId: ticket.id,
        fieldChanged: 'assignedToId',
        oldValue: ticket.assignedTo?.name || 'none',
        newValue: newAgentName,
        changedBy: userId,
      }));

      if (historyEntries.length > 0) {
        await tx.ticketHistory.createMany({ data: historyEntries });
      }

      const updateResult = await tx.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { assignedToId },
      });

      return updateResult.count;
    });
  }

  async bulkDelete(ticketIds) {
    return (await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } })).count;
  }
}

export default new TicketService();
