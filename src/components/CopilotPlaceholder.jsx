import React from 'react';

/**
 * CopilotPlaceholder Component
 *
 * Hosts the Microsoft Copilot Studio Web Chat iframe embed.
 */
export default function CopilotPlaceholder() {
  const copilotEmbedUrl =
    'https://copilotstudio.microsoft.com/environments/Default-e27ea0e3-d544-492a-bdfc-778865bdeeae/bots/cr606_adnocchatbottest_OWXeM4/webchat?__version__=2&enableFileAttachment=false&cliAgent=true';

  return (
    <div
      id="copilot-chat-container"
      className="copilot-chat-container"
    >
      <iframe
        src={copilotEmbedUrl}
        title="Copilot Studio Web Chat"
        frameBorder="0"
        allow="microphone; camera"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
        }}
      />
    </div>
  );
}
