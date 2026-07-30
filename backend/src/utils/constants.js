/**
 * @fileoverview Application-wide constants with expanded keywords for higher accuracy.
 * @module utils/constants
 */

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  USER: 'USER',
});

export const TICKET_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING: 'WAITING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

export const TICKET_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const TICKET_CATEGORIES = Object.freeze([
  'Technical Support',
  'Billing & Payments',
  'Account & Access',
  'Feature Request',
  'Bug Report',
  'General Inquiry',
]);

/**
 * Comprehensive keywords for better auto-categorization accuracy
 */
export const CATEGORY_KEYWORDS = Object.freeze({
  'Technical Support': [
    'error', 'not working', 'fix', 'help', 'issue', 'problem', 'crash', 'slow', 'network', 'connect', 
    'install', 'setup', 'config', 'server', 'database', 'api', 'integration', 'failed', 'timeout', 
    'loading', 'offline', 'broken link', 'white screen', 'frozen'
  ],
  'Billing & Payments': [
    'payment', 'invoice', 'charge', 'refund', 'money', 'price', 'billing', 'subscription', 'credit card', 
    'pay', 'transaction', 'receipt', 'overcharged', 'plan', 'renewal', 'upgrade', 'downgrade', 'checkout', 
    'coupon', 'discount', 'bank', 'transfer'
  ],
  'Account & Access': [
    'login', 'password', 'account', 'access', 'permission', 'reset', 'sign in', 'email', 'profile', 
    'locked', 'mfa', '2fa', 'security', 'logout', 'unauthorized', 'verification', 'signup', 'register', 
    'credential', 'username', 'portal'
  ],
  'Feature Request': [
    'suggest', 'add', 'feature', 'improve', 'idea', 'wish', 'new', 'would like', 'enhance', 'integration', 
    'capability', 'option', 'tool', 'functionality', 'requested', 'hope', 'feedback'
  ],
  'Bug Report': [
    'bug', 'glitch', 'broken', 'defect', 'wrong', 'fail', 'error code', 'vulnerability', 'unexpected', 
    'misbehaving', 'incorrect', 'loop', 'crash', 'stack trace', 'reproduce'
  ],
  'General Inquiry': [
    'question', 'info', 'details', 'how to', 'what is', 'thanks', 'hello', 'hi', 'greetings', 'about', 
    'documentation', 'tutorial', 'guide', 'contact', 'representative', 'support', 'clarification'
  ],
});

/**
 * Critical urgency keywords to ensure high-priority tickets are flagged correctly
 */
export const PRIORITY_KEYWORDS = Object.freeze({
  'CRITICAL': [
    'urgent', 'emergency', 'down', 'broken', 'critical', 'security', 'hack', 'outage', 'stop', 
    'immediate', 'production', 'vulnerability', 'blocking', 'fatal', 'asap', 'deadly', 'crash'
  ],
  'HIGH': [
    'important', 'soon', 'quickly', 'failure', 'unable', 'cannot', 'limited', 'serious', 
    'major', 'affecting', 'deadline', 'priority', 'needed', 'stuck'
  ],
  'MEDIUM': [
    'issue', 'problem', 'help', 'question', 'minor', 'working', 'some', 'intermittent', 
    'difficulty', 'unclear', 'clarify'
  ],
  'LOW': [
    'feedback', 'suggestion', 'typo', 'cosmetic', 'low', 'nice to have', 'someday', 'eventually', 
    'general', 'thought', 'idea'
  ],
});

/**
 * Sentiment keywords to detect user emotions without full text analysis
 */
export const SENTIMENT_KEYWORDS = Object.freeze({
  'frustrated': [
    'angry', 'bad', 'worst', 'disappointed', 'terrible', 'useless', 'hate', 'annoying', 'complaint', 
    'frustrated', 'ridiculous', 'horrible', 'waste', 'disgusting', 'garbage', 'trash', 'unacceptable'
  ],
  'negative': [
    'broken', 'fail', 'not working', 'error', 'wrong', 'unhappy', 'poor', 'missing', 'slow', 
    'confused', 'difficult', 'hard', 'struggling', 'dissatisfied', 'below'
  ],
  'positive': [
    'thanks', 'good', 'great', 'awesome', 'happy', 'solved', 'helpful', 'best', 'love', 'perfect', 
    'excellent', 'wonderful', 'appreciate', 'fixed', 'resolved', 'brilliant', 'amazing'
  ],
  'neutral': [
    'hello', 'hi', 'inquiry', 'regarding', 'question', 'please', 'inform', 'looking', 'wondering', 
    'request', 'information', 'status', 'update'
  ],
});

export const SENTIMENTS = Object.freeze([
  'positive',
  'neutral',
  'negative',
  'frustrated',
]);
