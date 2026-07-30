import userService from '../services/user.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Get all users (Admin only)
 * Can filter by role=USER for Customer Management
 */
export const findAll = async (req, res, next) => {
  try {
    const { page, limit, role, search, isActive } = req.query;
    const result = await userService.findAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      role,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    return successResponse(res, 'Users fetched successfully', result.users, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 */
export const findById = async (req, res, next) => {
  try {
    const user = await userService.findById(req.params.id);
    return successResponse(res, 'User fetched successfully', user);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Customer
 * Specifically for Customer Management to prevent role escalation
 */
export const createCustomer = async (req, res, next) => {
  try {
    const { name, email, password, phoneNumber, address } = req.body;
    // This calls the service method that forces role: 'USER'
    const user = await userService.createCustomer({ name, email, password, phoneNumber, address });
    return successResponse(res, 'Customer created successfully', user, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * General Create user (Admin for staff like Agents)
 */
export const create = async (req, res, next) => {
  try {
    const { name, email, password, role, phoneNumber, address } = req.body;
    const user = await userService.create({ name, email, password, role, phoneNumber, address });
    return successResponse(res, 'User created successfully', user, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user/customer
 */
export const update = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    return successResponse(res, 'User updated successfully', user);
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user
 */
export const deactivate = async (req, res, next) => {
  try {
    const result = await userService.deactivate(req.params.id);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Permanent Delete
 */
export const remove = async (req, res, next) => {
  try {
    const result = await userService.delete(req.params.id);
    return successResponse(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk delete
 */
export const bulkDelete = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return errorResponse(res, 'userIds must be a non-empty array', 400);
    }
    const count = await userService.bulkDelete(userIds);
    return successResponse(res, `${count} user(s) deleted successfully`, { count });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer-Specific Stats (Tickets raised, resolved, etc.)
 */
export const getCustomerStats = async (req, res, next) => {
  try {
    const stats = await userService.getCustomerStats(req.params.id);
    return successResponse(res, 'Customer stats fetched successfully', stats);
  } catch (error) {
    next(error);
  }
};
