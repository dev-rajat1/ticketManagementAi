import prisma from '../config/database.js';
import { successResponse } from '../utils/apiResponse.js';
import { ROLES, TICKET_STATUS } from '../utils/constants.js';

/**
 * Get dashboard statistics tailored to user roles
 */
export const getStats = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    
    let mainWhere = {};
    if (role === ROLES.USER) {
      mainWhere = { createdById: userId };
    } else if (role === ROLES.AGENT) {
      mainWhere = { assignedToId: userId };
    }

    const [
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed
    ] = await Promise.all([
      prisma.ticket.count({ where: mainWhere }),
      prisma.ticket.count({ where: { ...mainWhere, status: TICKET_STATUS.OPEN } }),
      prisma.ticket.count({ where: { ...mainWhere, status: TICKET_STATUS.IN_PROGRESS } }),
      prisma.ticket.count({ where: { ...mainWhere, status: TICKET_STATUS.WAITING } }),
      prisma.ticket.count({ where: { ...mainWhere, status: TICKET_STATUS.RESOLVED } }),
      prisma.ticket.count({ where: { ...mainWhere, status: TICKET_STATUS.CLOSED } }),
    ]);

    const pendingCount = open + inProgress + waiting;
    const closedCount = resolved + closed;

    let dashboardStats = {
      total,
      open,
      inProgress,
      waiting,
      pending: pendingCount,
      resolved,
      closed,
      closedTotal: closedCount,
    };

    if (role !== ROLES.USER) {
      const assignedCount = await prisma.ticket.count({
        where: { assignedToId: { not: null } }
      });
      const unassignedCount = await prisma.ticket.count({
        where: { assignedToId: null, status: { notIn: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } }
      });
      const myTickets = await prisma.ticket.count({
        where: { assignedToId: userId }
      });

      dashboardStats.totalGlobal = await prisma.ticket.count();
      dashboardStats.assigned = assignedCount;
      dashboardStats.unassigned = unassignedCount;
      dashboardStats.assignedToMe = myTickets;
    }

    let userStats = null;
    if (role === ROLES.ADMIN) {
      const [totalUsers, totalAgents, totalAdmins] = await Promise.all([
        prisma.user.count({ where: { role: ROLES.USER } }),
        prisma.user.count({ where: { role: ROLES.AGENT } }),
        prisma.user.count({ where: { role: ROLES.ADMIN } }),
      ]);
      userStats = { totalUsers, totalAgents, totalAdmins };
    }

    const resolvedTickets = await prisma.ticket.findMany({
      where: { 
        ...mainWhere, 
        status: { in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } 
      },
      select: { createdAt: true, updatedAt: true },
    });

    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        return sum + (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
    }

    return successResponse(res, 'Dashboard stats fetched', {
      tickets: dashboardStats,
      users: userStats,
      avgResolutionHours,
      role
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get chart data tailored to user roles
 */
export const getCharts = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    
    let where = {};
    if (role === ROLES.USER) {
      where = { createdById: userId };
    } else if (role === ROLES.AGENT) {
      where = { assignedToId: userId };
    }

    const byStatus = await prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: { id: true },
    });

    const byCategory = await prisma.ticket.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTickets = await prisma.ticket.findMany({
      where: { ...where, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const ticketsByDate = {};
    recentTickets.forEach((t) => {
      const date = t.createdAt.toISOString().split('T')[0];
      ticketsByDate[date] = (ticketsByDate[date] || 0) + 1;
    });

    const overTime = Object.entries(ticketsByDate).map(([date, count]) => ({
      date,
      count,
    }));

    return successResponse(res, 'Chart data fetched', {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      byCategory: byCategory.map((c) => ({ category: c.category || 'Uncategorized', count: c._count.id })),
      overTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent performance metrics (Admin Only)
 */
export const getAgentPerformance = async (req, res, next) => {
  try {
    const { search } = req.query;

    const where = { role: ROLES.AGENT };
    
    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm } },
        { email: { contains: searchTerm } }
      ];
    }

    const agents = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        _count: {
          select: { assignedTickets: true },
        },
      },
      orderBy: { name: 'asc' }
    });

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const [resolved, open, inProgress] = await Promise.all([
          prisma.ticket.count({ where: { assignedToId: agent.id, status: TICKET_STATUS.RESOLVED } }),
          prisma.ticket.count({ where: { assignedToId: agent.id, status: TICKET_STATUS.OPEN } }),
          prisma.ticket.count({ where: { assignedToId: agent.id, status: TICKET_STATUS.IN_PROGRESS } }),
        ]);

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          avatarUrl: agent.avatarUrl,
          totalAssigned: agent._count.assignedTickets,
          resolved,
          open,
          inProgress,
          resolutionRate:
            agent._count.assignedTickets > 0
              ? Math.round((resolved / agent._count.assignedTickets) * 100)
              : 0,
        };
      })
    );

    return successResponse(res, 'Agent performance fetched', agentStats);
  } catch (error) {
    next(error);
  }
};
