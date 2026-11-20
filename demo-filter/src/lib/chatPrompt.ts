export const CHAT_PROMPT_EVENT = 'northline:prompt-chat'

export function requestChatPrompt(prompt: string) {
  window.dispatchEvent(
    new CustomEvent<string>(CHAT_PROMPT_EVENT, { detail: prompt }),
  )
}
