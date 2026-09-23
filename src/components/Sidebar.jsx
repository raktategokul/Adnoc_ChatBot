import React from 'react';

/**
 * Groups an array of conversations by relative date (Today, Yesterday, Previous)
 */
function groupConversationsByDate(conversations) {
  const groups = {
    Today: [],
    Yesterday: [],
    Previous: [],
  };

  const now = new Date();
  const todayDate = now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toDateString();

  conversations.forEach((conv) => {
    const itemDate = new Date(conv.updated_at || conv.created_at).toDateString();
    if (itemDate === todayDate) {
      groups.Today.push(conv);
    } else if (itemDate === yesterdayDate) {
      groups.Yesterday.push(conv);
    } else {
      groups.Previous.push(conv);
    }
  });

  return groups;
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  isLoading,
}) {
  const groups = groupConversationsByDate(conversations);
  const [editingConvId, setEditingConvId] = React.useState(null);
  const [editTitle, setEditTitle] = React.useState('');

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditTitle(conv.title || 'New Chat');
  };

  const handleSaveRename = (convId) => {
    if (editTitle.trim()) {
      onRenameConversation?.(convId, editTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleKeyDown = (e, convId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(convId);
    } else if (e.key === 'Escape') {
      setEditingConvId(null);
    }
  };

  return (
    <aside className="chat-sidebar">
      {/* New Chat Button */}
      <div className="sidebar-action-header">
        <button className="new-chat-button" onClick={onNewChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="sidebar-scroll-area">
        {isLoading && conversations.length === 0 ? (
          <div className="sidebar-loading">
            <div className="sidebar-mini-spinner"></div>
            <span>Loading history...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="sidebar-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>No previous conversations</p>
            <span className="empty-hint">Start a new chat to begin</span>
          </div>
        ) : (
          Object.entries(groups).map(([groupName, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupName} className="conversation-group">
                <div className="conversation-group-title">{groupName}</div>
                <div className="conversation-group-items">
                  {items.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    const isEditing = editingConvId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className={`conversation-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectConversation(conv.id)}
                      >
                        <div className="conversation-item-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>

                        {isEditing ? (
                          <input
                            type="text"
                            className="conversation-edit-input"
                            value={editTitle}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleSaveRename(conv.id)}
                            onKeyDown={(e) => handleKeyDown(e, conv.id)}
                          />
                        ) : (
                          <span
                            className="conversation-item-title"
                            title={conv.title}
                            onDoubleClick={(e) => handleStartRename(e, conv)}
                          >
                            {conv.title || 'New Chat'}
                          </span>
                        )}

                        <div className="conversation-item-actions">
                          {onRenameConversation && !isEditing && (
                            <button
                              className="conversation-action-btn"
                              title="Rename conversation"
                              onClick={(e) => handleStartRename(e, conv)}
                              aria-label="Rename conversation"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                              </svg>
                            </button>
                          )}

                          {onDeleteConversation && !isEditing && (
                            <button
                              className="conversation-action-btn delete-btn"
                              title="Delete conversation"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                              }}
                              aria-label="Delete conversation"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
