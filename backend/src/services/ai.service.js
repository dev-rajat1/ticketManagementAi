import { aiModel } from '../config/ai.js';
import prisma from '../config/database.js';
import { TICKET_PRIORITY, SENTIMENTS } from '../utils/constants.js';

/**
 * AIService - Professional AI features for Ticket Management
 */
class AIService {
  /**
   * Internal helper to generate content
   */
  async _generate(prompt, temperature = 0.7) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn("⚠️ AI Warning: GEMINI_API_KEY is missing. Skipping AI generation.");
        return null;
      }

      const result = await aiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;
      const text = response.text();
      
      if (!text) throw new Error("Empty response from AI");
      return text.trim();
    } catch (err) {
      console.error("❌ Gemini AI Error:", err.message);
      return null;
    }
  }

  /**
   * Summarizes a ticket and its conversation history
   */
  async summarize(ticketId) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { comments: { take: 15, orderBy: { createdAt: 'desc' } } }
      });

      if (!ticket) return { summary: 'Ticket not found' };

      const convo = ticket.comments.length > 0 
        ? ticket.comments.reverse().map(c => `${c.userId === ticket.createdById ? 'Customer' : 'Agent'}: ${c.content}`).join('\n')
        : "No comments yet.";

      const prompt = `System: You are an expert support supervisor.
Task: Summarize the following support ticket into a concise 2-sentence summary for a quick status update.
Ticket Number: ${ticket.ticketNumber}
Subject: ${ticket.subject}
Description: ${ticket.description}
Recent Conversation:
${convo}

Summary:`;
      
      const summary = await this._generate(prompt, 0.3);
      const finalSummary = summary || 'AI could not generate a summary at this time.';
      
      await prisma.ticket.update({ 
        where: { id: ticketId }, 
        data: { aiSummary: finalSummary } 
      });
      
      return { summary: finalSummary };
    } catch (e) { 
      console.error("Summarize Error:", e);
      return { summary: 'Error generating summary.' }; 
    }
  }

  /**
   * Suggests professional responses based on ticket context
   */
  async suggestResponses(ticketId) {
    try {
      const ticket = await prisma.ticket.findUnique({ 
        where: { id: ticketId },
        include: { 
          comments: { take: 5, orderBy: { createdAt: 'desc' } },
          createdBy: { select: { name: true } }
        }
      });
      
      if (!ticket) return [];
      
      const convo = ticket.comments.reverse().map(c => c.content).join('\n');
      const prompt = `System: You are a highly professional customer support agent.
Context: 
Customer Name: ${ticket.createdBy.name}
Ticket Subject: ${ticket.subject}
Ticket Description: ${ticket.description}
Recent History: ${convo}

Task: Suggest ONE professional, helpful, and empathetic reply. 
Constraint: ONLY return the message body. Do not include subject lines or "Agent:" prefix.`;

      const reply = await this._generate(prompt, 0.8);
      if (!reply) return [];

      return [{ 
        tone: 'Professional', 
        response: reply 
      }];
    } catch (e) { 
      console.error("Suggest Error:", e);
      return []; 
    }
  }

  /**
   * Predicts ticket priority based on urgency keywords
   */
  async predictPriority(subject, description) {
    const priorities = Object.values(TICKET_PRIORITY);
    const prompt = `Analyze the urgency of this ticket and return EXACTLY ONE priority level: [${priorities.join(', ')}].
Criteria:
- CRITICAL: Production down, security breach, total service loss.
- HIGH: Significant impact, but workaround exists.
- MEDIUM: General issues, feature questions.
- LOW: Minor bugs, cosmetic issues, general feedback.

Subject: ${subject}
Description: ${description}

Priority (One word only):`;
    
    const text = await this._generate(prompt, 0.1);
    if (!text) return 'MEDIUM';

    return priorities.find(p => text.toUpperCase().includes(p)) || 'MEDIUM';
  }

  /**
   * Analyzes customer sentiment
   */
  async analyzeSentiment(text) {
    const prompt = `Analyze the sentiment of this customer message. Return EXACTLY ONE word from this list: [${SENTIMENTS.join(', ')}].
Message: ${text}

Sentiment:`;
    
    const res = await this._generate(prompt, 0.1);
    if (!res) return 'neutral';

    return SENTIMENTS.find(s => res.toLowerCase().includes(s.toLowerCase())) || 'neutral';
  }

  /**
   * Main background task to process new tickets (Removed Category AI)
   */
  async processNewTicket(ticketId) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return;

      console.log(`🤖 AI Processing (Non-Category) for Ticket: ${ticket.ticketNumber}`);

      const [priority, sentiment] = await Promise.all([
        this.predictPriority(ticket.subject, ticket.description),
        this.analyzeSentiment(ticket.description)
      ]);

      const summaryRes = await this.summarize(ticketId);

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { 
          priority: priority || ticket.priority, 
          aiSentiment: sentiment || 'neutral', 
          aiSummary: summaryRes.summary 
        }
      });
      
      console.log(`✅ AI processing complete for ${ticket.ticketNumber}`);
    } catch (e) {
      console.error("❌ Process Ticket Background Error:", e);
    }
  }
}

export default new AIService();
