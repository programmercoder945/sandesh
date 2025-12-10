export async function generateAESKey() {
  return crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, true, ["encrypt","decrypt"])
}

export async function encryptAES(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encData = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(data))
  return { encData, iv }
}

export async function decryptAES(key, encData, iv) {
  const dec = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, encData)
  return new TextDecoder().decode(dec)
}

// Simple wrapper parser for ^^html/markdown^^
export function parseMessage(msg) {
  const htmlMatch = msg.match(/\^\^\(html\)\^\^([\s\S]*)\^\^$/)
  const mdMatch = msg.match(/\^\^\(markdown\)\^\^([\s\S]*)\^\^$/)
  if(htmlMatch) return htmlMatch[1]
  if(mdMatch) return mdMatch[1] // in full app, convert Markdown to HTML
  return msg
}
