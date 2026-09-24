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

    // Parallel fetch: Group by status (1 query instead of 6 queries)
    const statusPromise = prisma.ticket.groupBy({
      by: ['status'],
      where: mainWhere,
      _count: { id: true }
    });

    // Total count for current filter
    const totalPromise = prisma.ticket.count({ where: mainWhere });

    // Recent resolved tickets for average resolution calculation (limit to 50 for max speed)
    const resolvedPromise = prisma.ticket.findMany({
      where: { 
        ...mainWhere, 
        status: { in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } 
      },
      select: { createdAt: true, updatedAt: true },
      take: 50,
      orderBy: { updatedAt: 'desc' }
    });

    // Optional admin/agent queries
    const agentPromises = (role !== ROLES.USER) ? [
      prisma.ticket.count({ where: { assignedToId: { not: null } } }),
      prisma.ticket.count({ where: { assignedToId: null, status: { notIn: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } } }),
      prisma.ticket.count({ where: { assignedToId: userId } }),
      prisma.ticket.count()
    ] : [];

    const adminPromise = (role === ROLES.ADMIN) ? prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    }) : Promise.resolve(null);

    const myUrgentPromise = (role === ROLES.AGENT) ? prisma.ticket.count({
      where: {
        assignedToId: userId,
        priority: { in: ['HIGH', 'CRITICAL'] },
        status: { notIn: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] }
      }
    }) : Promise.resolve(0);

    // Run EVERYTHING concurrently in a single roundtrip batch
    const [statusGroups, total, resolvedTickets, agentStats, adminGroups, myUrgent] = await Promise.all([
      statusPromise,
      totalPromise,
      resolvedPromise,
      Promise.all(agentPromises),
      adminPromise,
      myUrgentPromise
    ]);

    const statusMap = {};
    statusGroups.forEach(g => {
      statusMap[g.status] = g._count.id;
    });

    const open = statusMap[TICKET_STATUS.OPEN] || 0;
    const inProgress = statusMap[TICKET_STATUS.IN_PROGRESS] || 0;
    const waiting = statusMap[TICKET_STATUS.WAITING] || 0;
    const resolved = statusMap[TICKET_STATUS.RESOLVED] || 0;
    const closed = statusMap[TICKET_STATUS.CLOSED] || 0;

    let dashboardStats = {
      total,
      open,
      inProgress,
      waiting,
      pending: open + inProgress + waiting,
      resolved,
      closed,
      closedTotal: resolved + closed,
      myUrgent,
      assignedToMe: (role === ROLES.AGENT) ? total : (agentStats[2] || 0),
    };

    if (role !== ROLES.USER && agentStats.length >= 4) {
      dashboardStats.assigned = agentStats[0];
      dashboardStats.unassigned = agentStats[1];
      dashboardStats.totalGlobal = agentStats[3];
    }

    let userStats = null;
    if (role === ROLES.ADMIN && adminGroups) {
      const roleMap = {};
      adminGroups.forEach(g => { roleMap[g.role] = g._count.id; });
      userStats = {
        totalUsers: roleMap[ROLES.USER] || 0,
        totalAgents: roleMap[ROLES.AGENT] || 0,
        totalAdmins: roleMap[ROLES.ADMIN] || 0
      };
    }

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

    const agentIds = agents.map(a => a.id);
    const ticketCounts = agentIds.length > 0 ? await prisma.ticket.groupBy({
      by: ['assignedToId', 'status'],
      where: {
        assignedToId: { in: agentIds },
        status: { in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.OPEN, TICKET_STATUS.IN_PROGRESS] }
      },
      _count: { id: true }
    }) : [];

    const statsMap = {};
    ticketCounts.forEach(tc => {
      if (!statsMap[tc.assignedToId]) statsMap[tc.assignedToId] = {};
      statsMap[tc.assignedToId][tc.status] = tc._count.id;
    });

    const agentStats = agents.map((agent) => {
      const counts = statsMap[agent.id] || {};
      const resolved = counts[TICKET_STATUS.RESOLVED] || 0;
      const open = counts[TICKET_STATUS.OPEN] || 0;
      const inProgress = counts[TICKET_STATUS.IN_PROGRESS] || 0;

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
    });

    // Sort leaderboard by resolved count and resolution rate descending
    agentStats.sort((a, b) => (b.resolved - a.resolved) || (b.resolutionRate - a.resolutionRate));

    // Assign leaderboard ranks
    agentStats.forEach((agent, index) => {
      agent.rank = index + 1;
    });

    const currentAgentStats = agentStats.find(a => a.id === req.user.id) || null;

    return successResponse(res, 'Agent performance fetched', {
      agents: agentStats,
      myPerformance: currentAgentStats,
      isAgent: req.user.role === ROLES.AGENT
    });
  } catch (error) {
    next(error);
  }
};
