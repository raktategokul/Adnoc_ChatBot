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

/**
 * Checks whether an activity's message text represents an intermediate status / step announcement
 * (e.g. "Let me first explore the database...", "Now let me fetch the GC records with high-risk performance states...")
 * rather than the substantive final answer.
 */
export function isIntermediateMessage(text) {
  if (!text) return false;
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // If the message contains a Markdown table or multiple structured list items, it is a final/substantive result!
  if (
    clean.includes('|') ||
    clean.split('\n').filter((l) => {
      const trimmed = l.trim();
      return trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+\./.test(trimmed);
    }).length >= 2
  ) {
    return false;
  }

  // If text is long (> 280 chars) and does NOT start with a transitional action ("let me", "fetching", etc.), it's likely final
  const startsWithActionIntent = /^(now\s+|first\s+|next\s+|then\s+|so\s+)?(let\s+me|i\s+will|i'll|i\s+am\s+going\s+to|allow\s+me\s+to|fetching|querying|searching|exploring|retrieving)/i.test(lower);
  if (clean.length > 280 && !startsWithActionIntent) {
    return false;
  }

  // 1. Phrasing where the agent announces an upcoming action / fetch / search / check / query
  // Examples:
  // - "Let me first explore the database to find the relevant data!"
  // - "Now let me fetch the GC records with high-risk performance states (State 3 - Reactive or State 4 - Overloaded)..."
  // - "Next let me check the alarm KPI data..."
  // - "I will now query the database..."
  const actionIntentRegex = /\b(let\s+me|allow\s+me\s+to|i\s+will\s+now|i'll\s+now|i\s+am\s+now|i\s+am\s+going\s+to|now\s+let'?s|first\s+let\s+me|now\s+let\s+me|next\s+let\s+me|then\s+let\s+me|so\s+let\s+me)\b/i;
  const actionVerbsRegex = /\b(fetch|explore|query|search|find|retrieve|check|look|gather|pull|filter|load|access|inspect|analyze|examine|scan|get)\b/i;

  if (actionIntentRegex.test(lower) && actionVerbsRegex.test(lower)) {
    return true;
  }

  // 2. Active progressive verbs with data targets: "fetching the GC records...", "exploring the database..."
  const progressiveVerbRegex = /\b(fetch|fetching|explore|exploring|query|querying|search|searching|retrieve|retrieving|check|checking|gather|gathering|analyzing|filtering|loading|looking\s+into|looking\s+up|accessing)\b.*\b(database|kpi|alarm|gc|data|record|table|information|state|risk|contractor)/i;
  if (progressiveVerbRegex.test(lower)) {
    return true;
  }

  // 3. Waiting / holding phrases: "please wait...", "one moment...", "working on..."
  const waitRegex = /\b(one\s+moment|please\s+wait|hold\s+on|working\s+on\s+(it|this|that)|give\s+me\s+a\s+(moment|second|sec)|hang\s+tight|stand\s+by)\b/i;
  if (waitRegex.test(lower)) {
    return true;
  }

  return false;
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

  /**
   * Reset the current Direct Line session to start fresh
   */
  resetConversation() {
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
   * Send user message to Copilot Studio and collect ALL sequential response activities.
   * Supports an optional onActivity callback so each response bubble (e.g. status acknowledgment,
   * followed by database search results, followed by summary/cards) can appear in real-time.
   *
   * @param {string} userMessage - Text to send to Copilot Studio
   * @param {function} [onActivity] - Optional callback (parsedActivity) => void called as each response arrives
   * @returns {Promise<{ responses: Array<{ text: string, suggestedActions: Array }> }>}
   */
  async askCopilot(userMessage, onActivity = null) {
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

      // Synchronize watermark and register any lingering activity IDs before posting new prompt
      const seenActivityIds = new Set();
      if (this.conversationId && this.token) {
        try {
          const syncUrl = new URL(
            `https://directline.botframework.com/v3/directline/conversations/${this.conversationId}/activities`
          );
          if (this.watermark) {
            syncUrl.searchParams.set('watermark', this.watermark);
          }
          const syncRes = await fetch(syncUrl.toString(), {
            headers: { Authorization: `Bearer ${this.token}` },
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.watermark) {
              this.watermark = syncData.watermark;
            }
            if (Array.isArray(syncData.activities)) {
              for (const act of syncData.activities) {
                if (act.id) seenActivityIds.add(act.id);
              }
            }
          }
        } catch {
          // Non-blocking pre-sync
        }
      }

      // Post user message activity to Copilot Studio
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

      const allResponses = [];
      const startTime = Date.now();
      const maxTurnWaitMs = 75000; // Allow ample time for multi-step Copilot plugins and database lookups
      const pollDelayMs = 700; // Fast 700ms polling for responsive UX
      let consecutiveEmptyPolls = 0;
      let lastActivityTime = Date.now();
      let waitingForSubstantiveAnswer = false;
      let hasSubstantiveAnswer = false;

      while (Date.now() - startTime < maxTurnWaitMs) {
        await new Promise((r) => setTimeout(r, pollDelayMs));

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

          if (!pollRes.ok) {
            continue;
          }

          const pollData = await pollRes.json();
          if (pollData.watermark) {
            this.watermark = pollData.watermark;
          }

          const rawActivities = pollData.activities || [];
          let newMessagesInThisPoll = 0;

          for (const act of rawActivities) {
            // Skip user's own echoed messages
            if (act.from?.id === this.userId) continue;

            // Skip already seen activities
            if (act.id && seenActivityIds.has(act.id)) continue;
            if (act.id) seenActivityIds.add(act.id);

            // Handle typing indicator from Copilot Studio
            if (act.type === 'typing') {
              lastActivityTime = Date.now();
              consecutiveEmptyPolls = 0;
              continue;
            }

            // Handle bot message activities
            if (act.type === 'message' || (act.attachments && act.attachments.length > 0)) {
              const parsed = extractActivityContent(act);
              if (parsed.text && parsed.text.trim()) {
                allResponses.push(parsed);
                newMessagesInThisPoll++;
                lastActivityTime = Date.now();
                consecutiveEmptyPolls = 0;

                // Check if this is an intermediate announcement (e.g. "Let me first explore the database...", "Now let me fetch the GC records...")
                const isIntermediate = isIntermediateMessage(parsed.text);
                parsed.isIntermediate = isIntermediate;

                if (isIntermediate) {
                  waitingForSubstantiveAnswer = true;
                  hasSubstantiveAnswer = false;
                } else {
                  hasSubstantiveAnswer = true;
                  waitingForSubstantiveAnswer = false;
                }

                // Deliver immediately via progressive streaming callback if provided
                if (typeof onActivity === 'function') {
                  try {
                    onActivity(parsed);
                  } catch (cbErr) {
                    console.warn('Direct Line onActivity callback error:', cbErr);
                  }
                }
              }
            }
          }

          if (newMessagesInThisPoll === 0) {
            consecutiveEmptyPolls++;

            // If an intermediate acknowledgment was received (e.g. "Now let me fetch the GC records..."),
            // Copilot Studio is querying the database or plugin. DO NOT break prematurely!
            if (waitingForSubstantiveAnswer) {
              // Wait up to 50 seconds after acknowledgment for the database search to finish
              if (Date.now() - lastActivityTime > 50000) {
                break;
              }
            } else if (hasSubstantiveAnswer) {
              // Substantive final answer received.
              // Wait for 3 empty polls (~2s) of silence to catch any immediate follow-ups or action chips,
              // then conclude the turn so no lingering typing bubble stays.
              if (consecutiveEmptyPolls >= 3) {
                break;
              }
            } else if (allResponses.length > 0) {
              if (consecutiveEmptyPolls >= 3) {
                break;
              }
            }
          }
        } catch (pollErr) {
          console.warn('Direct Line poll error:', pollErr);
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
