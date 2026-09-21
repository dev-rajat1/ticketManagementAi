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
      const finalSummary = summary || `Ticket #${ticket.ticketNumber} regarding "${ticket.subject}". Current status is ${ticket.status} with ${ticket.priority} priority. Customer reported: "${ticket.description.slice(0, 150)}${ticket.description.length > 150 ? '...' : ''}"`;
      
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
      const finalReply = reply || `Hello ${ticket.createdBy?.name || 'Customer'},\n\nThank you for contacting our support team regarding "${ticket.subject}". We have logged your request and our team is currently investigating the issue. We will update you with a solution as soon as possible.\n\nBest regards,\nCustomer Support`;

      return [{ 
        tone: 'Professional', 
        response: finalReply 
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

  /**
   * Transcribes and analyzes call recording audio to generate ticket details
   */
  async generateTicketFromAudio(fileBuffer, mimeType, filename = 'recording.mp3') {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn("⚠️ AI Warning: GEMINI_API_KEY is missing. Using fallback for audio ticket.");
        return this.#fallbackAudioTicket(filename);
      }

      // Valid audio mimeTypes for Gemini: audio/mp3, audio/wav, audio/mpeg, audio/ogg, audio/m4a, etc.
      let validMime = mimeType;
      if (mimeType === 'audio/mp3') validMime = 'audio/mpeg';

      const prompt = `You are an expert customer support AI listening to a recorded customer call.
Analyze the audio thoroughly, transcribe the dialogue accurately, and return ONLY a valid JSON object matching this schema:
{
  "subject": "A concise 5 to 8 word descriptive title of the customer issue",
  "description": "Comprehensive explanation of what the customer called about, issues experienced, and any requested action",
  "transcript": "Accurate dialogue transcript formatted as [Customer]: ... [Agent]: ...",
  "priority": "LOW" or "MEDIUM" or "HIGH" or "CRITICAL",
  "category": "Technical Support" or "Billing & Payments" or "Account & Access" or "Feature Request" or "Bug Report" or "General Inquiry",
  "sentiment": "positive" or "neutral" or "frustrated" or "angry"
}

Respond ONLY with raw JSON. Do not include markdown code block backticks.`;

      const audioPart = {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType: validMime,
        },
      };

      const result = await aiModel.generateContent([
        audioPart,
        { text: prompt }
      ]);

      const response = await result.response;
      let text = response.text();
      if (!text) throw new Error("Empty response from AI for audio recording");

      // Strip code fences if present
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(text);
      return {
        subject: parsed.subject || `Call Recording Ticket (${filename})`,
        description: parsed.description || 'Call recording analyzed by SmartSupport AI.',
        transcript: parsed.transcript || 'Audio call processed successfully.',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.priority?.toUpperCase())
          ? parsed.priority.toUpperCase()
          : 'MEDIUM',
        category: parsed.category || 'General Inquiry',
        sentiment: parsed.sentiment?.toLowerCase() || 'neutral'
      };
    } catch (err) {
      console.error("❌ Gemini Audio Processing Error:", err.message);
      return this.#fallbackAudioTicket(filename);
    }
  }

  #fallbackAudioTicket(filename) {
    const cleanName = filename.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
    return {
      subject: `Call Recording Ticket - ${cleanName}`,
      description: `Support ticket automatically generated from customer call recording "${filename}". The audio file has been saved to attachments for playback.`,
      transcript: `[Auto-Processed]\nCall Recording: ${filename}\nThe audio has been recorded and safely stored. Support agents can listen to the full call using the embedded audio player below.`,
      priority: 'MEDIUM',
      category: 'General Inquiry',
      sentiment: 'neutral'
    };
  }
}

export default new AIService();

