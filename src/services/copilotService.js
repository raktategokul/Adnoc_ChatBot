/**
 * Copilot Studio Service Client
 * 
 * Communicates directly with Microsoft Copilot Studio via Direct Line / Token Endpoint API.
 * Ensures all sequential response activities are captured, parsed, and delivered.
 */

const STORAGE_ENDPOINT_KEY = 'nexusai_copilot_token_endpoint';
const STORAGE_SECRET_KEY = 'nexusai_direct_line_secret';

export const COPILOT_CONFIG = {
  get tokenEndpoint() {
    return (
      localStorage.getItem(STORAGE_ENDPOINT_KEY) ||
      import.meta.env.VITE_COPILOT_TOKEN_ENDPOINT ||
      ''
    );
  },
  set tokenEndpoint(val) {
    if (val) {
      localStorage.setItem(STORAGE_ENDPOINT_KEY, val);
    } else {
      localStorage.removeItem(STORAGE_ENDPOINT_KEY);
    }
  },

  get directLineSecret() {
    return (
      localStorage.getItem(STORAGE_SECRET_KEY) ||
      import.meta.env.VITE_DIRECT_LINE_SECRET ||
      ''
    );
  },
  set directLineSecret(val) {
    if (val) {
      localStorage.setItem(STORAGE_SECRET_KEY, val);
    } else {
      localStorage.removeItem(STORAGE_SECRET_KEY);
    }
  },
};

/**
 * Extracts all text and actions from an activity (including cards and attachments)
 */
function extractActivityContent(activity) {
  let text = (activity.text || '').trim();
  let actions = [];

  // Extract from suggestedActions
  if (activity.suggestedActions?.actions && Array.isArray(activity.suggestedActions.actions)) {
    actions = activity.suggestedActions.actions.map((a) => ({
      title: a.title || a.value,
      value: a.value || a.title,
    }));
  }

  // Extract from attachments (Adaptive Cards, Hero Cards, Thumbnail Cards, etc.)
  if (activity.attachments && activity.attachments.length > 0) {
    for (const att of activity.attachments) {
      const content = att.content;
      if (!content) continue;

      if (typeof content === 'string') {
        text = text ? `${text}\n\n${content}` : content;
      } else if (content.title || content.text || content.subtitle) {
        const cardHeader = content.title ? `**${content.title}**` : '';
        const cardSub = content.subtitle ? `*${content.subtitle}*` : '';
        const cardText = content.text || '';
        const cardCombined = [cardHeader, cardSub, cardText].filter(Boolean).join('\n');
        text = text ? `${text}\n\n${cardCombined}` : cardCombined;

        if (content.buttons && Array.isArray(content.buttons)) {
          content.buttons.forEach((b) => {
            actions.push({
              title: b.title || b.value,
              value: b.value || b.title,
            });
          });
        }
      } else if (Array.isArray(content.body)) {
        // Adaptive Card body
        const bodyTexts = [];
        content.body.forEach((item) => {
          if (item.type === 'TextBlock' && item.text) {
            bodyTexts.push(item.text);
          } else if (item.type === 'FactSet' && Array.isArray(item.facts)) {
            item.facts.forEach((f) => bodyTexts.push(`• **${f.title}:** ${f.value}`));
          }
        });
        if (bodyTexts.length > 0) {
          text = text ? `${text}\n\n${bodyTexts.join('\n')}` : bodyTexts.join('\n');
        }

        if (content.actions && Array.isArray(content.actions)) {
          content.actions.forEach((act) => {
            if (act.title) {
              actions.push({
                title: act.title,
                value: act.data || act.title,
              });
            }
          });
        }
      }
    }
  }

  return {
    text: text || 'Action received from Copilot Studio.',
    suggestedActions: actions,
  };
}

class CopilotService {
  constructor() {
    this.conversationId = null;
    this.token = null;
    this.watermark = null;
    this.userId = 'user_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Set configuration dynamically and persist to localStorage
   */
  setConfig({ tokenEndpoint, directLineSecret }) {
    if (tokenEndpoint !== undefined) COPILOT_CONFIG.tokenEndpoint = tokenEndpoint;
    if (directLineSecret !== undefined) COPILOT_CONFIG.directLineSecret = directLineSecret;
    // Reset conversation context on config change so fresh session is established
    this.conversationId = null;
    this.token = null;
    this.watermark = null;
  }

  isConfigured() {
    const ep = COPILOT_CONFIG.tokenEndpoint;
    const sec = COPILOT_CONFIG.directLineSecret;
    return Boolean((ep && !ep.includes('/webchat')) || sec);
  }

  /**
   * Acquire Direct Line token from the Copilot Studio Token Endpoint or Direct Line Secret
   */
  async acquireToken() {
    const endpoint = COPILOT_CONFIG.tokenEndpoint;
    const secret = COPILOT_CONFIG.directLineSecret;

    // 1. Token Endpoint from Copilot Studio (Channels > Mobile app)
    if (endpoint) {
      if (endpoint.includes('/webchat')) {
        throw new Error(
          'The provided URL is an iframe WebChat webpage, not an API Token Endpoint. Please copy the Token Endpoint from Copilot Studio > Channels > Mobile app.'
        );
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Token endpoint returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('No token found in response from Token Endpoint.');
      }

      if (data.conversationId) {
        this.conversationId = data.conversationId;
      }
      return data.token;
    }

    // 2. Direct Line Secret Key (Settings > Security > Web channel security)
    if (secret) {
      const response = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Direct Line token generation failed: HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('Direct Line did not return a valid token.');
      }
      return data.token;
    }

    return null;
  }

  /**
   * Start or resume Direct Line conversation with Copilot Studio
   */
  async ensureConversation() {
    if (!this.token) {
      this.token = await this.acquireToken();
    }

    if (!this.token) return false;

    if (!this.conversationId) {
      const convRes = await fetch('https://directline.botframework.com/v3/directline/conversations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!convRes.ok) {
        // Token might have expired, clear and retry once
        this.token = await this.acquireToken();
        const retryRes = await fetch('https://directline.botframework.com/v3/directline/conversations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!retryRes.ok) {
          throw new Error(`Failed to start Direct Line conversation with Copilot Studio (HTTP ${retryRes.status}).`);
        }
        const data = await retryRes.json();
        this.conversationId = data.conversationId;
      } else {
        const data = await convRes.json();
        this.conversationId = data.conversationId;
      }
    }

    return true;
  }

  /**
   * Send user message to Copilot Studio and collect ALL sequential response activities
   */
  async askCopilot(userMessage) {
    if (!this.isConfigured()) {
      return {
        responses: [
          {
            text: '⚙️ To receive responses from your live Copilot Studio agent, please enter your Token Endpoint (from Copilot Studio: Channels > Mobile app > Token Endpoint) or Direct Line Secret in Connection Settings.',
            isUnconfigured: true,
            suggestedActions: [{ title: '⚙️ Open Connection Settings', value: '__OPEN_SETTINGS__' }],
          },
        ],
      };
    }

    try {
      await this.ensureConversation();

      // Post activity to Copilot Studio
      const postRes = await fetch(
        `https://directline.botframework.com/v3/directline/conversations/${this.conversationId}/activities`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'message',
            from: { id: this.userId, name: 'User' },
            text: userMessage,
          }),
        }
      );

      if (!postRes.ok) {
        throw new Error(`Failed to send activity to Copilot Studio: HTTP ${postRes.status}`);
      }

      // Collect ALL bot response activities (Copilot Studio can send multiple activities with slight pauses)
      const allResponses = [];
      const startTime = Date.now();
      const maxWaitMs = 18000;
      let idlePollsAfterFirstMessage = 0;

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 900));

        const url = new URL(
          `https://directline.botframework.com/v3/directline/conversations/${this.conversationId}/activities`
        );
        if (this.watermark) {
          url.searchParams.set('watermark', this.watermark);
        }

        try {
          const pollRes = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${this.token}` },
          });

          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.watermark) {
              this.watermark = pollData.watermark;
            }

            // Filter for new messages from the bot
            const newActivities = (pollData.activities || []).filter(
              (a) => a.from?.id !== this.userId && (a.type === 'message' || (a.attachments && a.attachments.length > 0))
            );

            if (newActivities.length > 0) {
              idlePollsAfterFirstMessage = 0;
              for (const act of newActivities) {
                const parsed = extractActivityContent(act);
                if (parsed.text) {
                  allResponses.push(parsed);
                }
              }
            } else if (allResponses.length > 0) {
              // We already collected at least one response, check if bot has finished talking
              idlePollsAfterFirstMessage++;
              // If 2 polls (approx 1.8 seconds) have passed without any new activity, the turn is complete!
              if (idlePollsAfterFirstMessage >= 2) {
                break;
              }
            }
          }
        } catch (pollErr) {
          console.warn('Direct line poll error:', pollErr);
        }
      }

      if (allResponses.length > 0) {
        return {
          responses: allResponses,
        };
      }

      return {
        responses: [
          {
            text: 'The Copilot Studio agent did not reply within the timeout period. Please try asking again.',
          },
        ],
      };
    } catch (err) {
      console.error('Copilot Studio communication error:', err);
      return {
        responses: [
          {
            text: `⚠️ Error from Copilot Studio: ${err.message}. Please verify your Token Endpoint or Direct Line Secret in Connection Settings.`,
            suggestedActions: [{ title: '⚙️ Open Connection Settings', value: '__OPEN_SETTINGS__' }],
          },
        ],
      };
    }
  }
}

export const copilotService = new CopilotService();
