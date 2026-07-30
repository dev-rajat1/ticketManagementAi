import ticketService from '../services/ticket.service.js';
import aiService from '../services/ai.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { ROLES } from '../utils/constants.js';

/**
 * @desc    Create a new ticket
 * @route   POST /api/tickets
 * @access  Private (all roles)
 */
export const create = async (req, res, next) => {
  try {
    const { subject, description, priority, category, dueDate, assignedToId, createdById } = req.body;

    let finalCreatedById = req.user.id;
    let finalAssignedToId = assignedToId;

    // Admin can specify the customer (createdById) and assignee
    if (req.user.role === ROLES.ADMIN) {
      if (createdById) finalCreatedById = createdById;
    } else {
      // Regular staff/users can't set assignee or specify another creator
      finalAssignedToId = null;
      finalCreatedById = req.user.id;
    }

    const ticket = await ticketService.create(
      { 
        subject, 
        description, 
        priority: priority || 'MEDIUM', 
        category: category || 'General', 
        dueDate, 
        assignedToId: finalAssignedToId 
      },
      finalCreatedById,
    );

    return successResponse(res, 'Ticket created successfully', ticket, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all tickets with pagination and filters
 * @route   GET /api/tickets
 * @access  Private
 */
export const findAll = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      status,
      priority,
      category,
      assignedToId,
      createdById,
      search,
    } = req.query;

    let finalAssignedToId = assignedToId;

    // Enforce Agent isolation: If not admin and not explicitly filtering for unassigned, default to their own
    if (req.user.role === ROLES.AGENT) {
      if (!assignedToId || assignedToId === 'all') {
        finalAssignedToId = req.user.id;
      }
    }

    const filters = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      status: status ? status.toUpperCase() : undefined,
      priority: priority ? priority.toUpperCase() : undefined,
      category,
      assignedToId: finalAssignedToId,
      createdById,
      search,
    };

    // Regular users can ONLY see their own tickets
    if (req.user.role === ROLES.USER) {
      filters.createdById = req.user.id;
    }

    const result = await ticketService.findAll(filters);

    return successResponse(res, 'Tickets retrieved successfully', result.tickets, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single ticket by ID
 */
export const findById = async (req, res, next) => {
  try {
    const ticket = await ticketService.findById(req.params.id);
    if (!ticket) return errorResponse(res, 'Ticket not found', 404);

    if (req.user.role === ROLES.USER && ticket.createdById !== req.user.id) {
      return errorResponse(res, 'Access denied', 403);
    }

    return successResponse(res, 'Ticket retrieved successfully', ticket);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a ticket
 */
export const update = async (req, res, next) => {
  try {
    const ticket = await ticketService.findById(req.params.id);
    if (!ticket) return errorResponse(res, 'Ticket not found', 404);

    const { role } = req.user;
    const updates = req.body;

    if (updates.assignedToId && role !== ROLES.ADMIN) {
      return errorResponse(res, 'Only Admin can assign tickets', 403);
    }

    if (role === ROLES.AGENT) {
      const allowed = ['status'];
      const invalid = Object.keys(updates).filter(f => !allowed.includes(f));
      if (invalid.length > 0) return errorResponse(res, 'Agents can only update status', 403);
    }

    if (role === ROLES.USER) {
      if (ticket.createdById !== req.user.id) return errorResponse(res, 'Access denied', 403);
      delete updates.status;
      delete updates.priority;
      delete updates.assignedToId;
    }

    const updatedTicket = await ticketService.update(req.params.id, updates, req.user.id);
    return successResponse(res, 'Ticket updated successfully', updatedTicket);
  } catch (error) {
    next(error);
  }
};

/**
 * Audit and helper methods
 */
export const deleteTicket = async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.ADMIN) {
      return errorResponse(res, 'Only admins can delete tickets', 403);
    }
    await ticketService.delete(req.params.id);
    return successResponse(res, 'Ticket deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const comment = await ticketService.addComment(req.params.id, req.body.content, req.user.id);
    return successResponse(res, 'Comment added successfully', comment, 201);
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req, res, next) => {
  try {
    const comments = await ticketService.getComments(req.params.id);
    return successResponse(res, 'Comments retrieved', comments);
  } catch (error) {
    next(error);
  }
};

export const addAttachment = async (req, res, next) => {
  try {
    const attachment = await ticketService.addAttachment(req.params.id, req.file, req.user.id);
    return successResponse(res, 'Attachment uploaded', attachment, 201);
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment = async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    await ticketService.deleteAttachment(id, attachmentId);
    return successResponse(res, 'Attachment deleted');
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const history = await ticketService.getHistory(req.params.id);
    return successResponse(res, 'History retrieved', history);
  } catch (error) {
    next(error);
  }
};

export const bulkAction = async (req, res, next) => {
  try {
    const { action, ticketIds, status, assignedToId } = req.body;
    
    if (action === 'delete' && req.user.role !== ROLES.ADMIN) {
      return errorResponse(res, 'Only admins can bulk delete', 403);
    }

    let count = 0;
    if (action === 'updateStatus') count = await ticketService.bulkUpdateStatus(ticketIds, status, req.user.id);
    else if (action === 'assign') count = await ticketService.bulkAssign(ticketIds, assignedToId, req.user.id);
    else if (action === 'delete') count = await ticketService.bulkDelete(ticketIds);
    return successResponse(res, `${count} tickets processed`, { count });
  } catch (error) {
    next(error);
  }
};

export const getAiSummary = async (req, res, next) => {
  try {
    const summary = await aiService.summarize(req.params.id);
    return successResponse(res, 'AI Summary generated', summary);
  } catch (error) {
    next(error);
  }
};

export const getAiSuggestions = async (req, res, next) => {
  try {
    const suggestions = await aiService.suggestResponses(req.params.id);
    return successResponse(res, 'AI Suggestions retrieved', suggestions);
  } catch (error) {
    next(error);
  }
};
