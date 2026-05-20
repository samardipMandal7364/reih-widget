/** Ported from MediaChatModal/ChatType/AllTypes */
import { h } from 'preact';
import { parseMarkdown, sanitizeHtml } from '../../utils/helpers';

export function AllTypes({ author, content }) {
  const isUser = author === 'user';
  const text = typeof content === 'object' ? (content?.reasoning || content?.text || '') : (content || '');
  if (!text) return null;

  const html = parseMarkdown(sanitizeHtml(String(text)));

  return (
    h('div', {
      class: `mcm-chat-bubble${isUser ? ' mcm-chat-bubble--user' : ' mcm-chat-bubble--bot'}`,
      dangerouslySetInnerHTML: { __html: html },
    })
  );
}
