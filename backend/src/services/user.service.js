import prisma from '../config/database.js';
import bcrypt from 'bcrypt';

/**
 * UserService - Handles user management operations (Admin)
 */
class UserService {
  /**
   * Get all users with pagination and filters
   */
  async findAll({ page = 1, limit = 20, role, search, isActive }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (role) where.role = role;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          address: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              createdTickets: true,
              assignedTickets: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID with stats
   */
  async findById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        address: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdTickets: true,
            assignedTickets: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  /**
   * Create a new Customer (Strict Role: USER)
   */
  async createCustomer(data) {
    const { name, email, password, address, phoneNumber } = data;
    
    const existing = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (existing) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password || 'Customer@123', 12);
    
    return prisma.user.create({
      data: { 
        name, 
        email: email.toLowerCase(), 
        passwordHash, 
        role: 'USER', // Forced role for security
        address,
        phoneNumber,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * General Create (Admin for staff)
   */
  async create(data) {
    const { name, email, password, role, address, phoneNumber } = data;
    const passwordHash = await bcrypt.hash(password, 12);
    return prisma.user.create({
      data: { 
        name, 
        email: email.toLowerCase(), 
        passwordHash, 
        role: role || 'USER',
        address,
        phoneNumber
      }
    });
  }

  /**
   * Update user details
   */
  async update(id, data) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;
    
    // Protect Main Admin's role from being changed
    if (data.role && user.email !== 'admin@smartsupport.com') {
      updateData.role = data.role;
    }

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phoneNumber: true,
        address: true
      },
    });
  }

  /**
   * Deactivate user (Soft delete)
   */
  async deactivate(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.email === 'admin@smartsupport.com') {
      const error = new Error('Protected: Main Admin user cannot be deactivated');
      error.statusCode = 403;
      throw error;
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'User deactivated successfully' };
  }

  /**
   * Permanent Delete with full cleanup of related records
   */
  async delete(id) {
    const user = await prisma.user.findUnique({ 
      where: { id }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (user.email === 'admin@smartsupport.com') {
      const error = new Error('Protected: Main Admin user cannot be deleted');
      error.statusCode = 403;
      throw error;
    }

    try {
      // 1. Unassign tickets where user was assigned
      await prisma.ticket.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null }
      });
      // 2. Delete history entries made by this user
      await prisma.ticketHistory.deleteMany({ where: { changedBy: id } });
      // 3. Delete comments made by this user
      await prisma.comment.deleteMany({ where: { userId: id } });
      // 4. Delete attachments uploaded by this user
      await prisma.attachment.deleteMany({ where: { uploadedBy: id } });
      // 5. Delete tickets created by this user (this will cascade to ticket relations)
      await prisma.ticket.deleteMany({ where: { createdById: id } });
      // 6. Finally delete the user
      await prisma.user.delete({ where: { id } });

      return { message: 'User and all related records permanently deleted' };
    } catch (error) {
      console.error('Delete User Transaction Failed:', error);
      throw error;
    }
  }

  /**
   * Bulk Delete with cleanup
   */
  async bulkDelete(userIds) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true, email: true }
    });

    const safeIds = users
      .filter(u => u.email !== 'admin@smartsupport.com')
      .map(u => u.id);

    if (safeIds.length === 0) {
      const error = new Error('No deletable users selected (Main Admin is protected)');
      error.statusCode = 400;
      throw error;
    }

    try {
      // Unassign all
      await prisma.ticket.updateMany({
        where: { assignedToId: { in: safeIds } },
        data: { assignedToId: null }
      });
      // Delete history
      await prisma.ticketHistory.deleteMany({ where: { changedBy: { in: safeIds } } });
      // Delete comments
      await prisma.comment.deleteMany({ where: { userId: { in: safeIds } } });
      // Delete attachments
      await prisma.attachment.deleteMany({ where: { uploadedBy: { in: safeIds } } });
      // Delete created tickets
      await prisma.ticket.deleteMany({ where: { createdById: { in: safeIds } } });
      // Delete users
      await prisma.user.deleteMany({ where: { id: { in: safeIds } } });

      return safeIds.length;
    } catch (error) {
      console.error('Bulk Delete Transaction Failed:', error);
      throw error;
    }
  }

  /**
   * Get Customer-Specific Stats
   */
  async getCustomerStats(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    const [totalTickets, openTickets, resolvedTickets, lastTicket] = await Promise.all([
      prisma.ticket.count({ where: { createdById: id } }),
      prisma.ticket.count({ where: { createdById: id, status: 'OPEN' } }),
      prisma.ticket.count({ where: { createdById: id, status: 'RESOLVED' } }),
      prisma.ticket.findFirst({
        where: { createdById: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, ticketNumber: true }
      })
    ]);

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      lastTicketDate: lastTicket?.createdAt || null,
      lastTicketNumber: lastTicket?.ticketNumber || null,
      accountStatus: user.isActive ? 'Active' : 'Deactivated',
      memberSince: user.createdAt
    };
  }
}

export default new UserService();
